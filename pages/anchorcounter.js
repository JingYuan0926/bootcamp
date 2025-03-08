import { useState, useEffect } from "react";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider } from "@project-serum/anchor";
import { IDL } from "../smart contract/day1/anchor/idl";

// Program ID for your Anchor counter program
const PROGRAM_ID = "6JhDDhm13kv3QBADyFmYbGivQSbPDHEmN3Ex9Rks1ctC";

export default function AnchorCounter({ wallet }) {
  const [counterAccount, setCounterAccount] = useState(null);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [program, setProgram] = useState(null);

  // Initialize program when wallet is connected
  useEffect(() => {
    if (wallet && wallet.publicKey) {
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const provider = new AnchorProvider(
        connection,
        wallet,
        { commitment: "confirmed" }
      );
      
      const program = new Program(IDL, new PublicKey(PROGRAM_ID), provider);
      setProgram(program);
      console.log("Anchor program initialized");
    }
  }, [wallet]);

  // Create a new counter account
  const createCounterAccount = async () => {
    if (!wallet || !wallet.publicKey || !program) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Generate a new account keypair
      const newAccount = Keypair.generate();
      
      console.log("Creating new counter account:", newAccount.publicKey.toString());
      
      // Call the initialize method which will create the account
      await program.methods
        .initialize()
        .accounts({
          counter: newAccount.publicKey,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([newAccount])
        .rpc();
      
      setCounterAccount(newAccount);
      console.log("Counter account created:", newAccount.publicKey.toString());
      
      // Fetch initial count
      await fetchCount(newAccount.publicKey);
      
    } catch (err) {
      setError(`Error creating account: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch the current count from an account
  const fetchCount = async (accountPubkey) => {
    if (!program) return;
    
    try {
      const account = await program.account.counter.fetch(accountPubkey);
      setCount(account.count);
      console.log("Count fetched:", account.count);
    } catch (err) {
      console.error("Error fetching count:", err);
      setError("Failed to fetch counter data");
    }
  };

  // Set an existing counter account by pubkey
  const setExistingAccount = (pubkeyString) => {
    try {
      const pubkey = new PublicKey(pubkeyString);
      setCounterAccount({ publicKey: pubkey });
      // Don't automatically fetch the count
    } catch (err) {
      setError("Invalid public key");
    }
  };

  // Increment counter
  const incrementCounter = async () => {
    if (!counterAccount || !program) return;
    
    try {
      setLoading(true);
      
      await program.methods
        .increment()
        .accounts({
          counter: counterAccount.publicKey,
        })
        .rpc();
      
      await fetchCount(counterAccount.publicKey);
    } catch (err) {
      setError(`Error incrementing counter: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Decrement counter
  const decrementCounter = async () => {
    if (!counterAccount || !program) return;
    
    try {
      setLoading(true);
      
      await program.methods
        .decrement()
        .accounts({
          counter: counterAccount.publicKey,
        })
        .rpc();
      
      await fetchCount(counterAccount.publicKey);
    } catch (err) {
      setError(`Error decrementing counter: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // View counter with transaction (costs gas)
  const viewCounterWithTransaction = async () => {
    if (!counterAccount || !program) return;
    
    try {
      setLoading(true);
      
      await program.methods
        .view()
        .accounts({
          counter: counterAccount.publicKey,
        })
        .rpc();
      
      await fetchCount(counterAccount.publicKey);
    } catch (err) {
      setError(`Error viewing counter: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // View counter without transaction (free)
  const viewCounterFree = async () => {
    if (!counterAccount) return;
    
    try {
      setLoading(true);
      await fetchCount(counterAccount.publicKey);
      console.log("Counter viewed for free (no transaction fee)");
    } catch (err) {
      setError(`Error viewing counter: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {wallet && wallet.publicKey ? (
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
              {count !== null && <p className="text-2xl font-bold mb-4">Count: {count.toString()}</p>}
              
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
