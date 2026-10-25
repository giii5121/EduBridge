import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import Input from '../../components/ui/Input';
import Checkbox from '../../components/ui/Checkbox';
import Button from '../../components/ui/Button';

const Register = () => {
  const [agree, setAgree] = useState(false);
  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[599px]">
        <div className="bg-[#E5F2FE] rounded-[30px] shadow-[0px_4px_4px_0px_rgba(17,110,216,0.25)] p-10 relative">
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <img src="/assets/images/logo-circle.png" alt="Logo" className="w-[64px] h-[56px]" />
          </div>
          
          <div className="text-center mt-6 mb-6">
            <h2 className="font-fredoka font-semibold text-[30px] text-[#173B73] mb-2">
              Buat Akun Baru
            </h2>
            <p className="font-fredoka font-normal text-[16px] text-[#2A42A1] leading-[19.4px]">
              Daftar sekarang dan mulai belajar<br />bersama Nusaverse.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-3">
            <Input
              placeholder="Nama Lengkap"
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="7" r="4" stroke="#8A9AB0" strokeWidth="1.5"/>
                  <path d="M2 18C2 14.6863 4.68629 12 8 12H12C15.3137 12 18 14.6863 18 18" stroke="#8A9AB0" strokeWidth="1.5"/>
                </svg>
              }
            />
            <Input
              placeholder="Email / Username"
              icon={
                <svg width="22" height="13" viewBox="0 0 22 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="20" height="11" rx="2" stroke="#8A9AB0" strokeWidth="1.5"/>
                  <path d="M1 2L11 9L21 2" stroke="#8A9AB0" strokeWidth="1.5"/>
                </svg>
              }
            />
            <Input
              type="password"
              placeholder="Kata Sandi"
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="7" width="14" height="8" rx="1" stroke="#8A9AB0" strokeWidth="1.5"/>
                  <path d="M4 7V4C4 2.34315 5.34315 1 7 1H9C10.6569 1 12 2.34315 12 4V7" stroke="#8A9AB0" strokeWidth="1.5"/>
                </svg>
              }
            />
            <Input
              type="password"
              placeholder="Kofirmasi Kata Sandi"
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="7" width="14" height="8" rx="1" stroke="#8A9AB0" strokeWidth="1.5"/>
                  <path d="M4 7V4C4 2.34315 5.34315 1 7 1H9C10.6569 1 12 2.34315 12 4V7" stroke="#8A9AB0" strokeWidth="1.5"/>
                </svg>
              }
            />
            <Input
              placeholder="Asal Sekolah"
              icon={
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 2L3 7V20H19V7L11 2Z" stroke="#9B9B9B" strokeWidth="1.5"/>
                  <rect x="9" y="14" width="4" height="6" stroke="#9B9B9B" strokeWidth="1.5"/>
                </svg>
              }
            />
            <Input
              placeholder="Kelas"
              icon={
                <svg width="21" height="17" viewBox="0 0 21 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="19" height="15" rx="2" stroke="#9B9B9B" strokeWidth="1.5"/>
                  <path d="M7 6L9 8L7 10M14 6L12 8L14 10" stroke="#9B9B9B" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
            />

            <div className="pt-2">
              <Checkbox
                label="Saya menyetujui Syarat & Ketentuan"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
            </div>

            <Button type="submit" className="w-full h-[60px] text-[24px] mt-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15M10 17L15 12M15 12L10 7M15 12H3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Register
            </Button>
          </form>

          <div className="text-center mt-4">
            <Link to="/login" className="font-poppins text-[15px] text-black/60 hover:text-black/80">
              Sudah Punya Akun? <span className="font-medium">Log In</span>
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Register;
