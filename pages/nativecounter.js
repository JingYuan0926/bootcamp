import { useState, useEffect } from "react";
import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair, SystemProgram } from "@solana/web3.js";
import { Buffer } from "buffer";

// Program ID for your native counter program
const PROGRAM_ID = "BZyom31cPHJMb1MMdwa8guiAnV8k6GZqkxrridx1U51J";

// Native Counter class and serialization
class Counter {
  count = 0;
  constructor(fields) {
    if (fields) {
      this.count = fields.count;
    }
  }
}

function serializeCounter(counter) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(counter.count, 0);
  return buffer;
}

function deserializeCounter(buffer) {
  if (buffer.length < 4) {
    throw new Error("Buffer too small");
  }
  return new Counter({ count: buffer.readUInt32LE(0) });
}

export default function NativeCounter({ wallet }) {
  const { publicKey, sendTransaction } = wallet || {};
  const [counterAccount, setCounterAccount] = useState(null);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create a counter account
  const createCounterAccount = async () => {
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Create connection to devnet
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      
      // Generate a new account keypair
      const newAccount = Keypair.generate();
      
      // Calculate size needed for the counter (4 bytes for u32)
      const dataSize = 4;
      
      // Calculate minimum lamports needed
      const lamports = await connection.getMinimumBalanceForRentExemption(dataSize);
      
      // Create transaction to allocate space for counter
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: newAccount.publicKey,
          lamports,
          space: dataSize,
          programId: new PublicKey(PROGRAM_ID),
        })
      );
      
      // Send transaction
      const signature = await sendTransaction(transaction, connection, {
        signers: [newAccount]
      });
      
      await connection.confirmTransaction(signature);
      
      setCounterAccount(newAccount);
      
      // Initialize the counter (not needed with our auto-init contract)
      setTimeout(() => getCount(newAccount.publicKey), 2000);
      
    } catch (err) {
      setError(`Error creating account: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Send instruction to the counter program
  const sendInstruction = async (instructionCode) => {
    if (!publicKey || !counterAccount) {
      setError("Please connect wallet and create a counter account first");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Create connection to devnet
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      
      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: counterAccount.publicKey, isSigner: false, isWritable: true }
        ],
        programId: new PublicKey(PROGRAM_ID),
        data: Buffer.from([instructionCode]) // The instruction code (1 = increment, 2 = decrement, 3 = view)
      });
      
      // Create and send transaction
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);
      
      await connection.confirmTransaction(signature);

      // Always fetch the count after an operation
      setTimeout(() => getCount(counterAccount.publicKey), 2000);
      
    } catch (err) {
      setError(`Error sending instruction: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Get the current count from the account
  const getCount = async (pubkey) => {
    const accountKey = pubkey || (counterAccount ? counterAccount.publicKey : null);
    if (!accountKey) return;
    
    try {
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const accountInfo = await connection.getAccountInfo(accountKey);
      
      if (accountInfo && accountInfo.data) {
        try {
          const counter = deserializeCounter(accountInfo.data);
          setCount(counter.count);
        } catch (err) {
          console.error("Error deserializing counter:", err);
          setError("Failed to read counter data");
        }
      }
    } catch (err) {
      console.error("Error fetching count:", err);
    }
  };

  // Increment the counter
  const incrementCounter = () => sendInstruction(1);
  
  // Decrement the counter
  const decrementCounter = () => sendInstruction(2);
  
  // View counter (using transaction - costs gas)
  const viewCounterWithTransaction = () => sendInstruction(3);

  // View counter (direct account read - free, no gas)
  const viewCounterFree = async () => {
    setLoading(true);
    setError("");
    try {
      await getCount();
      console.log("Counter viewed for free (no transaction fee)");
    } catch (err) {
      setError(`Error viewing counter: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // If you already have a counter account, you can set it here
  const setExistingAccount = (pubkeyString) => {
    try {
      const pubkey = new PublicKey(pubkeyString);
      setCounterAccount({ publicKey: pubkey });
      // Don't automatically fetch the count
    } catch (err) {
      setError("Invalid public key");
    }
  };

  return (
    <div>
      {publicKey ? (
        <div className="mb-6">

          
          {!counterAccount ? (
            <div>
              <button 
                onClick={createCounterAccount}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
              >
                Create Counter Account
              </button>
              
              <div className="mt-3">
                <p className="mb-1">Or enter existing account:</p>
                <input 
                  type="text" 
                  placeholder="Account public key"
                  className="border p-2 mr-2"
                  onChange={(e) => setExistingAccount(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2">Counter Account: {counterAccount.publicKey.toString()}</p>
              {count !== null && <p className="text-2xl font-bold mb-4">Count: {count}</p>}
              
              <div className="flex flex-wrap space-x-2 space-y-2 md:space-y-0">
                <button 
                  onClick={incrementCounter}
                  disabled={loading}
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Increment
                </button>
                <button 
                  onClick={decrementCounter}
                  disabled={loading}
                  className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
                >
                  Decrement
                </button>
                <button 
                  onClick={viewCounterWithTransaction}
                  disabled={loading}
                  className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                >
                  View (With Fee)
                </button>
                <button 
                  onClick={viewCounterFree}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  View (Free)
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p>Please connect your wallet to use the counter</p>
      )}
      
      {error && <p className="text-red-500">{error}</p>}
      {loading && <p>Loading...</p>}
    </div>
  );
}
