import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import Input from '../../components/ui/Input';
import Checkbox from '../../components/ui/Checkbox';
import Button from '../../components/ui/Button';

const Login = () => {
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[599px]">
        <div className="bg-[#E5F2FE] rounded-[30px] shadow-[0px_4px_4px_0px_rgba(17,110,216,0.25)] p-12 relative">
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <img src="/assets/images/logo-circle.png" alt="Logo" className="w-[64px] h-[56px]" />
          </div>
          
          <div className="text-center mt-6 mb-8">
            <h2 className="font-fredoka font-semibold text-[32px] text-[#173B73] mb-2">
              Selamat Datang!
            </h2>
            <p className="font-fredoka font-normal text-[20px] text-[#2A42A1] leading-[24.2px]">
              Masuk ke akun Nusaverse kamu untuk<br />melanjutkan perjalanan belajar.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              placeholder="Email atau Username"
              icon={
                <svg width="30" height="20" viewBox="0 0 30 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L15 12L29 1M1 19V1H29V19H1Z" stroke="#8A9AB0" strokeWidth="1.5"/>
                </svg>
              }
            />
            <Input
              type="password"
              placeholder="Kata Sandi"
              icon={
                <svg width="22" height="23" viewBox="0 0 22 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="9" width="20" height="13" rx="2" stroke="#8A9AB0" strokeWidth="1.5"/>
                  <path d="M5 9V5C5 2.79086 6.79086 1 9 1H13C15.2091 1 17 2.79086 17 5V9" stroke="#8A9AB0" strokeWidth="1.5"/>
                </svg>
              }
            />

            <div className="flex items-center justify-between pt-2">
              <Checkbox
                label="Ingat saya"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
            </div>

            <Button type="submit" className="w-full h-[60px] text-[24px] mt-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15M10 17L15 12M15 12L10 7M15 12H3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Masuk
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link to="/register" className="font-poppins text-[15px] text-black/60 hover:text-black/80">
              Belum Punya Akun? <span className="font-medium">Daftar Akun</span>
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
