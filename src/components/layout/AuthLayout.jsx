const AuthLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Side - Hero Section */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[54%] xl:w-[58%]">
        <img
          src="/assets/images/auth-bg.png"
          alt="Background"
          className="absolute inset-x-0 bottom-0 h-auto w-full object-contain"
        />
        <div className="relative z-10 flex w-full flex-col justify-between gap-8 p-8 xl:p-12 2xl:p-16">
          <div className="mt-6 xl:mt-12">
            <div className="flex max-w-[640px] items-center gap-4 xl:gap-6">
              <img
                src="/assets/images/logo.png"
                alt="EduBridge"
                className="h-auto w-[104px] shrink-0 object-contain xl:w-[140px] 2xl:w-[170px]"
              />
              <div className="min-w-0 flex-1">
                <h1 className="font-fredoka text-[44px] font-bold leading-[1.1] text-[#2A42A1] xl:text-[64px] 2xl:text-[80px]">
                  EduBridge
                </h1>
                <p className="mt-2 font-fredoka text-[22px] font-semibold leading-[1.2] text-[#96CDF2] xl:text-[30px] 2xl:text-[38px]">
                  Belajar Matematika<br />Raih Masa Depan
                </p>
                <p className="mt-4 max-w-[491px] font-fredoka text-[15px] font-medium leading-[1.35] text-[#3A81DA] xl:mt-6 xl:text-[21px] 2xl:text-[24px]">
                  Platform pembelajaran matematika interaktif untuk siswa, guru, dan sekolah.
                </p>
              </div>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-3 xl:mb-10 xl:gap-4">
            <span className="rounded-full bg-white/90 px-3 py-1.5 font-fredoka text-[15px] text-[#3A81DA] xl:px-4 xl:py-2 xl:text-[18px]">
              Aljabar
            </span>
            <span className="rounded-full bg-white/90 px-3 py-1.5 font-fredoka text-[15px] text-[#3A81DA] xl:px-4 xl:py-2 xl:text-[18px]">
              Geometri
            </span>
            <span className="rounded-full bg-white/90 px-3 py-1.5 font-fredoka text-[15px] text-[#3A81DA] xl:px-4 xl:py-2 xl:text-[18px]">
              Kalkulus
            </span>
          </div>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="flex w-full justify-center p-4 py-10 sm:p-8 lg:w-[46%] xl:w-[42%]">
        <div className="m-auto w-full min-w-0 max-w-[599px]">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;
