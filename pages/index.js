import { useState, useEffect } from "react";
import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";
import WalletButton from "../components/WalletButton";

// Define the Counter class for Borsh serialization/deserialization
class Counter {
  count = 0;
  constructor(fields) {
    if (fields) {
      this.count = fields.count;
    }
  }
}

// Define a simple serialization/deserialization for the Counter
// This avoids using the borsh package directly which was causing issues
function serializeCounter(counter) {
  const buffer = Buffer.alloc(4); // 4 bytes for a u32
  buffer.writeUInt32LE(counter.count, 0);
  return buffer;
}

function deserializeCounter(buffer) {
  if (buffer.length < 4) {
    throw new Error("Buffer too small");
  }
  return new Counter({ count: buffer.readUInt32LE(0) });
}

// Program ID for your counter program
const PROGRAM_ID = "CV3nhk4ovkysVB6Wkngf5VH6eNfMwJxr6qfizhpak9nP";

export default function Home() {
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const [counterAccount, setCounterAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(null);
  const [error, setError] = useState("");
  
  // Check for wallet connection changes
  useEffect(() => {
    if (publicKey) {
      console.log("Wallet connected:", publicKey.toString());
    }
  }, [publicKey]);

  // Connect to the current wallet
  const connectWallet = (wallet) => {
    console.log("Wallet connected in Home component:", wallet.publicKey.toString());
  };

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
      alert(`Created counter account: ${newAccount.publicKey.toString()}`);
      
      // Initialize the counter (not needed with our auto-init contract)
      setTimeout(() => getCount(), 2000);
      
    } catch (err) {
      setError(`Error creating account: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to send instructions to the counter program
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
      setTimeout(() => getCount(), 2000);
      
    } catch (err) {
      setError(`Error sending instruction: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Increment the counter
  const incrementCounter = () => sendInstruction(1);
  
  // Decrement the counter
  const decrementCounter = () => sendInstruction(2);
  
  // View the counter
  const viewCounter = () => sendInstruction(3);

  // Get the current count from the account
  const getCount = async () => {
    if (!counterAccount) return;
    
    try {
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const accountInfo = await connection.getAccountInfo(counterAccount.publicKey);
      
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

  // If you already have a counter account, you can set it here
  const setExistingAccount = (pubkeyString) => {
    try {
      const pubkey = new PublicKey(pubkeyString);
      setCounterAccount({ publicKey: pubkey });
      // Try to get the current count
      setTimeout(() => getCount(), 500);
    } catch (err) {
      setError("Invalid public key");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Solana Counter App</h1>
      
      <div className="mb-6">
        <WalletButton onConnect={connectWallet} />
      </div>
      
      {publicKey && (
        <div className="mb-6">
          <p className="mb-2">Connected: {publicKey.toString()}</p>
          
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
              
              <div className="flex space-x-2">
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
                  onClick={viewCounter}
                  disabled={loading}
                  className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                >
                  View Count
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {error && <p className="text-red-500">{error}</p>}
      {loading && <p>Loading...</p>}
    </div>
  );
}
