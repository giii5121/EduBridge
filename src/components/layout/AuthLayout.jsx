const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-white flex">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden">
        <img 
          src="/assets/images/auth-bg.png" 
          alt="Background" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          <div className="mt-20">
            <div className="flex items-center gap-4 mb-6">
              <img src="/assets/images/logo.png" alt="EduBridge" className="w-[181px] h-[159px]" />
              <div>
                <h1 className="font-fredoka font-bold text-[90px] text-[#2A42A1] leading-[108.9px]">EduBridge</h1>
                <p className="font-fredoka font-semibold text-[40px] text-[#96CDF2] leading-[48.4px] mt-2">
                  Belajar Matematika<br />Raih Masa Depan
                </p>
              </div>
            </div>
            <p className="font-fredoka font-medium text-[24px] text-[#3A81DA] leading-[29px] max-w-[491px] mt-8">
              Platform pembelajaran matematika interaktif untuk siswa, guru, dan sekolah.
            </p>
          </div>
          <div className="flex gap-4 mb-20">
            <span className="bg-white/90 px-4 py-2 rounded-full font-fredoka text-[20px] text-[#3A81DA]">Aljabar</span>
            <span className="bg-white/90 px-4 py-2 rounded-full font-fredoka text-[20px] text-[#3A81DA]">Geometri</span>
            <span className="bg-white/90 px-4 py-2 rounded-full font-fredoka text-[20px] text-[#3A81DA]">Kalkulus</span>
          </div>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-8">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
