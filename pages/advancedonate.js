import { useEffect, useState } from "react";
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN, web3 } from "@project-serum/anchor";
import { useWallet } from '@solana/wallet-adapter-react';
import { Button, Card, CardBody, Input, Progress, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Badge, Tooltip } from "@nextui-org/react";
// Import IDL with support for both named and default exports
import * as IDLImport from "../smart contract/day2/advance/idl.js";
import { FiExternalLink } from 'react-icons/fi';
import dynamic from 'next/dynamic';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Make sure this PROGRAM_ID matches the one in your lib.rs
const PROGRAM_ID = new PublicKey("7YnuSNqj6zkE2zakxsUpjwDpmi5MEszXV2L4Kd5EtW8w");

// Try to get IDL from either default or named export
const IDL = IDLImport.default || IDLImport.IDL;

// Import WalletButton and Header component with client-side only rendering
const Header = dynamic(() => import('../components/Header.js'), { ssr: false });

export default function DonationApp() {
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [spacexTokensMinted, setSpacexTokensMinted] = useState(0);
  const [spacexTokenBalance, setSpacexTokenBalance] = useState(0);
  const [error, setError] = useState(null);

  // Campaign details
  const campaignGoal = 1000; // 1000 SOL
  const currentAmount = contributions.reduce((acc, record) =>
    acc + (record.amount.toNumber() / LAMPORTS_PER_SOL), 0);
  const progressPercentage = (currentAmount / campaignGoal) * 100;

  useEffect(() => {
    fetchContributionEvents();
    if (wallet.connected) {
      fetchTokenBalance();
    }
  }, [wallet.connected]);

  const getProgram = () => {
    if (!wallet || !wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      throw new Error("Wallet not connected or not fully initialized");
    }

    try {
      const connection = new Connection(clusterApiUrl("devnet"));
      // Create a custom provider that ensures the wallet is properly configured
      const provider = new AnchorProvider(
        connection, 
        {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions,
        }, 
        { preflightCommitment: "processed" }
      );
      
      // Debug the IDL
      console.log("IDL Import:", typeof IDL, IDL ? "defined" : "undefined");
      
      // Fallback IDL if the import is failing
      const fallbackIDL = {
        "version": "0.1.0",
        "name": "donation_events",
        "instructions": [
          {
            "name": "recordDonation",
            "accounts": [
              { "name": "donor", "isMut": true, "isSigner": true },
              { "name": "vault", "isMut": true, "isSigner": false },
              { "name": "systemProgram", "isMut": false, "isSigner": false },
              { "name": "spacexMint", "isMut": true, "isSigner": false },
              { "name": "userTokenAccount", "isMut": true, "isSigner": false },
              { "name": "mintAuthority", "isMut": false, "isSigner": false },
              { "name": "tokenProgram", "isMut": false, "isSigner": false }
            ],
            "args": [{ "name": "amount", "type": "u64" }]
          },
          {
            "name": "initializeMint",
            "accounts": [
              { "name": "payer", "isMut": true, "isSigner": true },
              { "name": "spacexMint", "isMut": true, "isSigner": true },
              { "name": "mintAuthority", "isMut": false, "isSigner": false },
              { "name": "systemProgram", "isMut": false, "isSigner": false },
              { "name": "tokenProgram", "isMut": false, "isSigner": false },
              { "name": "rent", "isMut": false, "isSigner": false }
            ],
            "args": []
          }
        ]
      };
      
      // Use the imported IDL or fall back to the hardcoded one
      const actualIDL = (IDL && typeof IDL === 'object') ? IDL : fallbackIDL;
      
      return new Program(actualIDL, PROGRAM_ID, provider);
    } catch (err) {
      console.error("Error creating program:", err);
      setError("Failed to initialize Solana program. Please check your wallet connection and try again.");
      throw err;
    }
  };

  const fetchTokenBalance = async () => {
    if (!wallet.publicKey) return;

    try {
      const connection = new Connection(clusterApiUrl("devnet"));
      
      // Get the spacex mint PDA
      const [spacexMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("spacex_token_mint")],
        PROGRAM_ID
      );
      
      try {
        // Get the associated token account address
        const userTokenAccount = await getAssociatedTokenAddress(
          spacexMintPDA,
          wallet.publicKey
        );
        
        // Check if the token account exists
        const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
        
        if (tokenAccountInfo) {
          // In a real app, you'd parse the token account data to get the actual balance
          // For demo purposes, we'll fetch recent transactions and sum up tokens received
          const tokens = contributions
            .filter(c => c.donor.toString() === wallet.publicKey.toString())
            .reduce((sum, c) => sum + c.spacexTokens, 0);
            
          setSpacexTokenBalance(tokens);
        } else {
          setSpacexTokenBalance(0);
        }
      } catch (e) {
        console.log("Token account doesn't exist yet:", e);
        setSpacexTokenBalance(0);
      }
    } catch (error) {
      console.error("Error fetching token balance:", error);
      setSpacexTokenBalance(0);
    }
  };

  const fetchContributionEvents = async () => {
    try {
      const connection = new Connection(clusterApiUrl("devnet"));
      const signatures = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 10 });

      const contributionEvents = [];

      for (const sig of signatures) {
        const tx = await connection.getParsedTransaction(sig.signature);
        if (!tx?.meta?.logMessages) continue;

        for (const log of tx.meta.logMessages) {
          if (log.includes("DONATION_EVENT:")) {
            const [, eventData] = log.split("DONATION_EVENT: ");
            const matches = eventData.match(/donor=(.*), amount=(.*), timestamp=(.*), spacex_tokens_minted=(.*)/);

            if (matches) {
              contributionEvents.push({
                donor: new PublicKey(matches[1]),
                amount: new BN(matches[2]),
                timestamp: parseInt(matches[3]),
                spacexTokens: parseInt(matches[4] || 0),
                signature: sig.signature
              });
            }
          }
        }
      }

      setContributions(contributionEvents);
    } catch (error) {
      console.error("Error fetching contribution events:", error);
    }
  };

  const contribute = async () => {
    if (!amount || !wallet.connected) {
      return;
    }

    setLoading(true);
    try {
      const program = getProgram();
      const contributionAmount = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
      const connection = new Connection(clusterApiUrl("devnet"));

      // Get the PDA for the vault
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("donation_vault")],
        PROGRAM_ID
      );

      // Get the mint authority PDA
      const [mintAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_authority")],
        PROGRAM_ID
      );
      
      // Get the spacex mint PDA
      const [spacexMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("spacex_token_mint")],
        PROGRAM_ID
      );
      
      // Calculate the associated token account address
      const userTokenAccount = await getAssociatedTokenAddress(
        spacexMintPDA,
        wallet.publicKey
      );

      // Create transaction
      const transaction = new web3.Transaction();
      
      // Add the donation instruction
      transaction.add(
        await program.methods
          .recordDonation(contributionAmount)
          .accounts({
            donor: wallet.publicKey,
            vault: vaultPDA,
            spacexMint: spacexMintPDA,
            userTokenAccount: userTokenAccount,
            mintAuthority: mintAuthority,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: web3.SYSVAR_RENT_PUBKEY
          })
          .instruction()
      );

      // Send the transaction
      const tx = await wallet.sendTransaction(transaction, connection);
      await connection.confirmTransaction(tx, 'confirmed');

      setAmount("");
      setTransactionHash(tx);
      setSpacexTokensMinted(contributionAmount.toNumber() / 1_000_000); // 1 token per 0.001 SOL
      setShowSuccessModal(true);
      
      // Refresh data
      await fetchContributionEvents();
      await fetchTokenBalance();
    } catch (error) {
      console.error("Error recording contribution:", error);
      setError("Error recording contribution: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="relative z-10">
        <Header />
        
        <div className="flex flex-col gap-8 items-center pt-20 px-4 pb-24">
          <div className="w-full max-w-[1400px] space-y-8">
            {/* Main content */}
            <div className="relative w-full h-[500px] rounded-xl overflow-hidden">
              <img
                src="https://ebsedu.org/wp-content/uploads/elementor/thumbs/Elon-Musk-SpaceX-qrhfmhgqe2huzg4k3z2y0rmsiisq9mtdi80p1t479g.jpg"
                alt="SpaceX Falcon Heavy Launch"
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  objectPosition: 'center 40%'
                }}
              />
            </div>

            <div className="max-w-4xl mx-auto space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-4xl font-bold text-white">SpaceX Starship Development Fund</h1>
                  {wallet.connected && spacexTokenBalance > 0 && (
                    <Badge content={spacexTokenBalance} color="warning" placement="bottom-right">
                      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 rounded-lg flex items-center gap-2">
                        <img src="/spacex-token-icon.png" alt="SpaceX Token" className="w-6 h-6" onError={(e) => e.target.style.display = 'none'} />
                        <span className="text-white font-semibold">SpaceX Coins</span>
                      </div>
                    </Badge>
                  )}
                </div>
                <p className="text-gray-300 leading-relaxed text-lg">
                  Help SpaceX revolutionize space travel with the development of Starship,
                  the most powerful rocket ever built. Your contribution will directly support
                  the advancement of reusable rocket technology and humanity&apos;s journey to Mars.
                  <span className="block mt-2 text-yellow-300">Earn SpaceX Coins with every donation!</span>
                </p>

                {/* Donation progress bar */}
                <div className="relative p-[1px] rounded-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 animate-pulse" />
                  <div className="relative backdrop-blur-sm rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white">Raised</span>
                      <span className="text-white font-semibold">{currentAmount.toFixed(5)} SOL of {campaignGoal} SOL</span>
                    </div>
                    <Progress
                      value={progressPercentage}
                      className="h-3"
                      classNames={{
                        indicator: "bg-gradient-to-r from-pink-500 to-yellow-500"
                      }}
                    />
                    <div className="flex gap-8 text-sm text-gray-300 pt-2">
                      <div className="flex gap-2">
                        <span>Contributors</span>
                        <span className="text-white">{contributions.length}</span>
                      </div>
                      <div className="flex gap-2">
                        <span>Days Left</span>
                        <span className="text-white">12</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Donation form */}
              {wallet.connected ? (
                <div className="relative p-[1px] rounded-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 animate-pulse" />
                  <Card className="relative backdrop-blur-sm border-0">
                    <CardBody className="p-6">
                      <h2 className="text-xl font-bold text-white mb-4">Support This Project</h2>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Remove any non-numeric characters except decimal point
                            const numericValue = value.replace(/[^\d.]/g, '');
                            
                            // Ensure only one decimal point
                            const parts = numericValue.split('.');
                            if (parts.length > 2) {
                              return;
                            }
                            
                            setAmount(numericValue);
                          }}
                          placeholder="Amount in SOL"
                          endContent={
                            <div className="pointer-events-none flex items-center">
                              <span className="text-default-400 text-small">SOL</span>
                            </div>
                          }
                          className="flex-1"
                          classNames={{
                            input: "bg-black/20 text-white",
                            inputWrapper: "bg-black/20 border-white/20"
                          }}
                        />
                        <Button
                          onClick={contribute}
                          disabled={loading || !amount || parseFloat(amount) <= 0}
                          className={`text-white font-semibold ${
                            loading || !amount || parseFloat(amount) <= 0
                              ? "bg-gradient-to-tr from-pink-900 to-yellow-900 opacity-50 cursor-not-allowed"
                              : "bg-gradient-to-tr from-pink-500 to-yellow-500"
                          }`}
                          isLoading={loading}
                        >
                          {loading ? "Processing..." : "Contribute"}
                        </Button>
                      </div>
                      <p className="text-yellow-300 text-sm mt-2">You'll automatically receive SpaceX Coins with your donation!</p>
                    </CardBody>
                  </Card>
                </div>
              ) : (
                <Card className="backdrop-blur-md border border-white/10">
                  <CardBody className="text-center py-8 px-12">
                    <p className="text-white mb-2">Please connect your wallet to contribute</p>
                    <span className="text-gray-400 text-sm">
                      Click the &quot;Select Wallet&quot; button above
                    </span>
                  </CardBody>
                </Card>
              )}

              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">Recent Contributors</h2>
                {contributions.length === 0 ? (
                  <Card className="backdrop-blur-md border border-white/10">
                    <CardBody>
                      <p className="text-gray-400 text-center">No contributions yet. Be the first!</p>
                    </CardBody>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {contributions.map((record, index) => (
                      <Card key={index} className="backdrop-blur-md border border-white/10">
                        <CardBody className="p-4">
                          <div className="flex justify-between items-center">
                            <div className="truncate">
                              <span className="text-gray-400">Contributor: </span>
                              <span className="text-white">
                                {record.donor.toString().slice(0, 4)}...
                                {record.donor.toString().slice(-4)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              {record.spacexTokens > 0 && (
                                <div className="flex items-center gap-1 bg-yellow-500/20 rounded-full px-2 py-1">
                                  <span className="text-yellow-300 text-sm">+{record.spacexTokens} SpaceX</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-white font-semibold">
                                  {(record.amount.toString() / LAMPORTS_PER_SOL).toFixed(5)} SOL
                                </span>
                                <a
                                  href={`https://explorer.solana.com/tx/${record.signature}?cluster=devnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-white transition-colors"
                                >
                                  <FiExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {new Date(record.timestamp * 1000).toLocaleString()}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                    <div className="h-12"></div>
                  </div>
                )}
              </div>
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
            <p className="text-white text-center mb-4">
              Your contribution has been recorded successfully!
            </p>
            {spacexTokensMinted > 0 && (
              <div className="w-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-4 mb-4 text-center">
                <p className="text-yellow-300 font-bold text-xl mb-1">🚀 You earned SpaceX Coins! 🚀</p>
                <p className="text-white">{spacexTokensMinted} SpaceX Coins have been added to your wallet</p>
              </div>
            )}
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
              className="bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 text-white font-semibold w-full"
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