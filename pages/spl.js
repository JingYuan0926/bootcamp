import { useEffect, useState } from "react";
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN, web3 } from "@project-serum/anchor";
import { useWallet } from '@solana/wallet-adapter-react';
import { Button, Card, CardBody, Input, Progress, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Badge, Tooltip } from "@nextui-org/react";
import { FiExternalLink } from 'react-icons/fi';
import dynamic from 'next/dynamic';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  MintLayout
} from '@solana/spl-token';

// Make sure this PROGRAM_ID matches the one in your lib.rs
const PROGRAM_ID = new PublicKey("A9REH6DTms1Jxzj3csutdn1wpBdCk9yBHNxAdrx4H5K5");

// Import Header component with client-side only rendering
const Header = dynamic(() => import('../components/Header.js'), { ssr: false });

export default function SPLTokenDemo() {
  const wallet = useWallet();
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [mintedTransactions, setMintedTransactions] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [error, setError] = useState(null);
  const [tokenMint, setTokenMint] = useState(null);
  const [tokenAccount, setTokenAccount] = useState(null);
  const [mintInitialized, setMintInitialized] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    if (wallet.connected) {
      checkMintStatus();
    }
  }, [wallet.connected]);

  const checkMintStatus = async () => {
    try {
      const connection = new Connection(clusterApiUrl("devnet"), 'confirmed');
      
      // Create a predictable mint keypair for demo purposes
      const mintKeypair = web3.Keypair.generate();
      setTokenMint(mintKeypair);
      
      console.log("Token Mint:", mintKeypair.publicKey.toString());
      
      // Check if mint exists
      const mintInfo = await connection.getAccountInfo(mintKeypair.publicKey);
      setMintInitialized(mintInfo !== null);
      
      if (mintInfo !== null) {
        // Check if user token account exists
        const userTokenAccount = await getAssociatedTokenAddress(
          mintKeypair.publicKey,
          wallet.publicKey
        );
        
        setTokenAccount(userTokenAccount);
        console.log("User Token Account:", userTokenAccount.toString());
        
        const accountInfo = await connection.getAccountInfo(userTokenAccount);
        setAccountCreated(accountInfo !== null);
        
        // Update token balance if account exists
        if (accountInfo !== null) {
          fetchTokenBalance();
        }
      }
    } catch (error) {
      console.error("Error checking mint status:", error);
      setError("Error checking mint status: " + error.message);
    }
  };

  const fetchTokenBalance = async () => {
    if (!wallet.publicKey || !tokenMint) return;

    try {
      const connection = new Connection(clusterApiUrl("devnet"), 'confirmed');
      
      // Get the associated token account address
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        wallet.publicKey
      );
      
      try {
        // Check if the token account exists
        const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
        
        if (tokenAccountInfo) {
          // In a real app, you'd parse the token account data to get the actual balance
          // This is a simplified approach for demo
          const mintedAmount = mintedTransactions.reduce(
            (sum, tx) => sum + parseInt(tx.amount), 
            0
          );
          
          setTokenBalance(mintedAmount);
        } else {
          setTokenBalance(0);
        }
      } catch (e) {
        console.log("Token account doesn't exist yet:", e);
        setTokenBalance(0);
      }
    } catch (error) {
      console.error("Error fetching token balance:", error);
      setTokenBalance(0);
    }
  };

  const initializeMint = async () => {
    if (!wallet.connected || !tokenMint) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log("Initializing token mint...");
      
      // Connect to Solana
      const connection = new Connection(clusterApiUrl("devnet"), 'confirmed');
      
      // Check if user has enough SOL
      const balance = await connection.getBalance(wallet.publicKey);
      console.log("User SOL balance:", balance / LAMPORTS_PER_SOL);
      
      if (balance < 10000000) { // 0.01 SOL
        throw new Error("Not enough SOL to pay for transaction fees");
      }
      
      // Calculate minimum lamports needed for rent exemption
      const lamports = await connection.getMinimumBalanceForRentExemption(MintLayout.span);
      
      // Create a new transaction
      const transaction = new web3.Transaction();
      
      // Add instruction to create account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: tokenMint.publicKey,
          lamports,
          space: MintLayout.span,
          programId: TOKEN_PROGRAM_ID
        })
      );
      
      // Add instruction to initialize mint
      transaction.add(
        createInitializeMintInstruction(
          tokenMint.publicKey,
          6, // Decimals
          wallet.publicKey, // Mint authority
          wallet.publicKey, // Freeze authority
          TOKEN_PROGRAM_ID
        )
      );
      
      // Get FRESH blockhash
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Sign with both the wallet and the mint keypair
      transaction.sign(tokenMint);
      
      // Send transaction
      const signed = await wallet.signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      
      console.log("Mint initialization transaction sent:", txid);
      
      // Wait for confirmation
      await connection.confirmTransaction(txid, 'confirmed');
      console.log("Mint initialized successfully");
      
      // Update state
      setMintInitialized(true);
      setTransactionHash(txid);
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error("Error initializing mint:", error);
      
      let errorMessage = "Error initializing mint: ";
      if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Unknown error occurred";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createTokenAccount = async () => {
    if (!wallet.connected || !tokenMint || !mintInitialized) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log("Creating token account...");
      
      // Connect to Solana
      const connection = new Connection(clusterApiUrl("devnet"), 'confirmed');
      
      // Get the associated token account address
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        wallet.publicKey
      );
      
      setTokenAccount(userTokenAccount);
      console.log("User Token Account:", userTokenAccount.toString());
      
      // Create a new transaction
      const transaction = new web3.Transaction();
      
      // Add instruction to create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey, // payer
          userTokenAccount, // associated token account
          wallet.publicKey, // owner
          tokenMint.publicKey // mint
        )
      );
      
      // Get FRESH blockhash
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Send transaction
      const signed = await wallet.signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      
      console.log("Token account creation transaction sent:", txid);
      
      // Wait for confirmation
      await connection.confirmTransaction(txid, 'confirmed');
      console.log("Token account created successfully");
      
      // Update state
      setAccountCreated(true);
      setTransactionHash(txid);
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error("Error creating token account:", error);
      
      let errorMessage = "Error creating token account: ";
      if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Unknown error occurred";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const mintTokens = async () => {
    if (!amount || !wallet.connected || !tokenMint || !tokenAccount || !mintInitialized || !accountCreated) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log("Minting tokens...");
      
      // Connect to Solana
      const connection = new Connection(clusterApiUrl("devnet"), 'confirmed');
      
      // Parse amount to mint
      const amountToMint = parseInt(amount);
      
      // Create a new transaction
      const transaction = new web3.Transaction();
      
      // Add instruction to mint tokens
      transaction.add(
        createMintToInstruction(
          tokenMint.publicKey, // mint
          tokenAccount, // destination
          wallet.publicKey, // authority
          amountToMint * Math.pow(10, 6) // amount (with decimals)
        )
      );
      
      // Get FRESH blockhash
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Send transaction
      const signed = await wallet.signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      
      console.log("Token mint transaction sent:", txid);
      
      // Wait for confirmation
      await connection.confirmTransaction(txid, 'confirmed');
      console.log("Tokens minted successfully");
      
      // Record the successful mint
      const newTx = {
        signature: txid,
        amount: amount,
        timestamp: Date.now()
      };
      
      setMintedTransactions(prev => [newTx, ...prev]);
      setTransactionHash(txid);
      setShowSuccessModal(true);
      
      // Update token balance
      setTimeout(() => {
        fetchTokenBalance();
      }, 2000);
      
    } catch (error) {
      console.error("Error minting tokens:", error);
      
      let errorMessage = "Error minting tokens: ";
      if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Unknown error occurred";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="relative z-10">
        <Header />
        
        <div className="flex flex-col gap-8 items-center pt-20 px-4 pb-24">
          <div className="w-full max-w-[1200px] space-y-8">
            {/* Main content */}
            <div className="relative w-full h-[300px] rounded-xl overflow-hidden">
              <img
                src="https://solana.com/src/img/branding/solanaLogoMark.svg"
                alt="Solana Logo"
                className="absolute inset-0 w-full h-full object-cover bg-gradient-to-r from-purple-900 via-black to-purple-900"
                style={{
                  objectFit: 'contain',
                  padding: '40px'
                }}
              />
            </div>

            <div className="max-w-4xl mx-auto space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-4xl font-bold text-white">SPL Token Creation Demo</h1>
                  {wallet.connected && tokenBalance > 0 && (
                    <Badge content={tokenBalance} color="warning" placement="bottom-right">
                      <div className="bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 rounded-lg flex items-center gap-2">
                        <span className="text-white font-semibold">SpaceX Tokens</span>
                      </div>
                    </Badge>
                  )}
                </div>
                
                <p className="text-gray-300 leading-relaxed text-lg">
                  This is a step-by-step demonstration of SPL token creation on Solana.
                  Follow the steps below to create your own token!
                </p>
                
                {/* Steps Indicator */}
                <div className="flex flex-col sm:flex-row justify-between bg-gray-900/50 p-4 rounded-lg">
                  <div className={`flex items-center gap-2 ${mintInitialized ? 'text-green-400' : 'text-white'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mintInitialized ? 'bg-green-400 text-black' : 'bg-white/20 text-white'}`}>
                      1
                    </div>
                    <span>Initialize Token Mint</span>
                    {mintInitialized && <span className="text-green-400">✓</span>}
                  </div>
                  
                  <div className={`flex items-center gap-2 ${accountCreated ? 'text-green-400' : 'text-white'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${accountCreated ? 'bg-green-400 text-black' : 'bg-white/20 text-white'}`}>
                      2
                    </div>
                    <span>Create Token Account</span>
                    {accountCreated && <span className="text-green-400">✓</span>}
                  </div>
                  
                  <div className={`flex items-center gap-2 ${tokenBalance > 0 ? 'text-green-400' : 'text-white'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tokenBalance > 0 ? 'bg-green-400 text-black' : 'bg-white/20 text-white'}`}>
                      3
                    </div>
                    <span>Mint Tokens</span>
                    {tokenBalance > 0 && <span className="text-green-400">✓</span>}
                  </div>
                </div>
              </div>
              
              {wallet.connected ? (
                <div className="space-y-6">
                  {/* Step 1: Initialize Mint */}
                  <div className="relative p-[1px] rounded-xl overflow-hidden">
                    <div className={`absolute inset-0 ${mintInitialized ? 'bg-green-500/30' : 'bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-pulse'}`} />
                    <Card className="relative backdrop-blur-sm border-0">
                      <CardBody className="p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Step 1: Initialize Token Mint</h2>
                        {mintInitialized ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <span>✓</span>
                            <p>Token mint initialized successfully</p>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-300 mb-4">
                              First, we need to create a new SPL token mint. This is like creating a new
                              currency that you control. The mint will be used to issue tokens later.
                            </p>
                            <Button
                              onClick={initializeMint}
                              disabled={loading}
                              className={`text-white font-semibold w-full ${
                                loading
                                  ? "bg-gradient-to-tr from-purple-900 to-blue-900 opacity-50 cursor-not-allowed"
                                  : "bg-gradient-to-tr from-purple-500 to-blue-500"
                              }`}
                              isLoading={loading}
                            >
                              {loading ? "Initializing..." : "Initialize Token Mint"}
                            </Button>
                          </>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                  
                  {/* Step 2: Create Token Account */}
                  <div className="relative p-[1px] rounded-xl overflow-hidden">
                    <div className={`absolute inset-0 ${accountCreated ? 'bg-green-500/30' : mintInitialized ? 'bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-pulse' : 'bg-gray-500/30'}`} />
                    <Card className="relative backdrop-blur-sm border-0">
                      <CardBody className="p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Step 2: Create Token Account</h2>
                        {accountCreated ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <span>✓</span>
                            <p>Token account created successfully</p>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-300 mb-4">
                              Now, we need to create a token account to hold your tokens. This is like
                              creating a wallet specifically for this token type.
                            </p>
                            <Button
                              onClick={createTokenAccount}
                              disabled={loading || !mintInitialized}
                              className={`text-white font-semibold w-full ${
                                loading || !mintInitialized
                                  ? "bg-gradient-to-tr from-purple-900 to-blue-900 opacity-50 cursor-not-allowed"
                                  : "bg-gradient-to-tr from-purple-500 to-blue-500"
                              }`}
                              isLoading={loading}
                            >
                              {loading ? "Creating..." : "Create Token Account"}
                            </Button>
                            {!mintInitialized && (
                              <p className="text-yellow-300 text-sm mt-2">Complete Step 1 first</p>
                            )}
                          </>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                  
                  {/* Step 3: Mint Tokens */}
                  <div className="relative p-[1px] rounded-xl overflow-hidden">
                    <div className={`absolute inset-0 ${!accountCreated ? 'bg-gray-500/30' : 'bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-pulse'}`} />
                    <Card className="relative backdrop-blur-sm border-0">
                      <CardBody className="p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Step 3: Mint Tokens</h2>
                        <p className="text-gray-300 mb-4">
                          Finally, mint tokens to your account. You can mint any amount you want!
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={amount}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Only allow positive integers
                              if (value === '' || /^\d+$/.test(value)) {
                                setAmount(value);
                              }
                            }}
                            placeholder="Token Amount"
                            endContent={
                              <div className="pointer-events-none flex items-center">
                                <span className="text-default-400 text-small">Tokens</span>
                              </div>
                            }
                            className="flex-1"
                            classNames={{
                              input: "bg-black/20 text-white",
                              inputWrapper: "bg-black/20 border-white/20"
                            }}
                          />
                          <Button
                            onClick={mintTokens}
                            disabled={loading || !amount || parseInt(amount) <= 0 || !accountCreated}
                            className={`text-white font-semibold ${
                              loading || !amount || parseInt(amount) <= 0 || !accountCreated
                                ? "bg-gradient-to-tr from-purple-900 to-blue-900 opacity-50 cursor-not-allowed"
                                : "bg-gradient-to-tr from-purple-500 to-blue-500"
                            }`}
                            isLoading={loading}
                          >
                            {loading ? "Minting..." : "Mint Tokens"}
                          </Button>
                        </div>
                        {!accountCreated && (
                          <p className="text-yellow-300 text-sm mt-2">Complete Steps 1 and 2 first</p>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                </div>
              ) : (
                <Card className="backdrop-blur-md border border-white/10">
                  <CardBody className="text-center py-8 px-12">
                    <p className="text-white mb-2">Please connect your wallet to create tokens</p>
                    <span className="text-gray-400 text-sm">
                      Click the &quot;Select Wallet&quot; button above
                    </span>
                  </CardBody>
                </Card>
              )}
              
              {/* Transaction history */}
              {mintedTransactions.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
                  <div className="space-y-2">
                    {mintedTransactions.map((tx, index) => (
                      <Card key={index} className="backdrop-blur-md border border-white/10">
                        <CardBody className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-white font-semibold">
                                {tx.amount} Tokens
                              </span>
                              <p className="text-sm text-gray-400 mt-1">
                                {new Date(tx.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <a
                              href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <FiExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Success modal */}
      <Modal 
        isOpen={showSuccessModal} 
        onClose={() => setShowSuccessModal(false)}
        size="md"
        hideCloseButton={true}
        isDismissable={false}
        classNames={{
          backdrop: "backdrop-blur-sm",
          base: "border border-white/20 bg-black",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 text-white">
            Transaction Successful
          </ModalHeader>
          <ModalBody className="flex flex-col items-center py-6">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-white text-2xl">🪙</span>
            </div>
            {mintInitialized && !accountCreated && (
              <p className="text-white text-center mb-4">
                Token mint initialized successfully!
              </p>
            )}
            {accountCreated && tokenBalance === 0 && (
              <p className="text-white text-center mb-4">
                Token account created successfully!
              </p>
            )}
            {tokenBalance > 0 && (
              <p className="text-white text-center mb-4">
                {amount} tokens have been minted to your wallet!
              </p>
            )}
            <p className="text-blue-300 text-center mb-4">
              You can view these transactions on Solana Explorer.
            </p>
            <div className="bg-white/10 p-3 rounded-lg w-full">
              <p className="text-sm text-gray-400">Transaction Hash:</p>
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-mono break-all">
                  {transactionHash}
                </p>
                <a
                  href={`https://explorer.solana.com/tx/${transactionHash}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FiExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold w-full"
              onPress={() => setShowSuccessModal(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Error display */}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-900/80 text-white p-4 rounded-lg z-50">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
          <button 
            className="mt-2 bg-white/20 px-3 py-1 rounded hover:bg-white/30"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}