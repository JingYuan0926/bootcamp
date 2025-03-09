import WalletButton from "./WalletButton";

const Header = () => {
  return (
    <header className="w-full bg-gradient-to-r from-purple-900/80 via-black/80 to-pink-900/80 backdrop-blur-lg border-b border-white/10 py-3 px-6 sticky top-0 transition-all duration-300">
      <div className="w-full max-w-[1400px] mx-auto flex justify-between items-center">
        <div className="text-white text-xl font-bold flex items-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500">SpaceX Funding</span>
        </div>
        <div className="flex items-center transform hover:scale-105 transition-transform duration-300">
          <WalletButton />
        </div>
      </div>
    </header>
  );
};

export default Header; 