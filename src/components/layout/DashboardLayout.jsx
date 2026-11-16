import { Link, useLocation } from 'react-router-dom';
import sidebarMascot from '../../assets/images/mascots/mascot-2-1-4.png';

const DashboardLayout = ({ children }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'home' },
    { path: '/katalog', label: 'Katalog Materi', icon: 'book' },
    { path: '/kuis', label: 'Kuis', icon: 'quiz' },
    { path: '/progres', label: 'Progres', icon: 'progress' },
    { path: '/profil', label: 'Profil', icon: 'profile' },
  ];

  return (
    <div className="flex min-h-screen min-w-0 bg-[#F3F6FB]">
      {/* Sidebar */}
      <aside className="sticky top-0 z-20 flex h-screen min-h-[620px] w-[220px] shrink-0 flex-col overflow-hidden border-r border-white/70 bg-[#DDF1FF] sm:w-[236px] md:w-[250px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 12% 43%, rgba(255,255,255,.9) 0 12%, transparent 12.5%), radial-gradient(ellipse at 93% 48%, rgba(255,255,255,.8) 0 15%, transparent 15.5%), radial-gradient(ellipse at 44% 69%, rgba(255,255,255,.88) 0 17%, transparent 17.5%), linear-gradient(180deg, #eaf7ff 0%, #c4e7ff 56%, #f5faff 100%)',
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-[430px] rotate-[-8deg] rounded-[50%] bg-[#FFE49A]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-12 h-48 w-[390px] rounded-[50%] bg-[#9BD5FF]" />
        <div className="relative z-10 flex min-h-[128px] items-start gap-2 px-3 pt-4">
          <img src="/assets/images/logo.png" alt="Logo EduBridge" className="mt-1 h-[60px] w-[60px] shrink-0 object-contain" />
          <div className="min-w-0 pt-1">
            <h2 className="font-fredoka text-[24px] font-bold leading-[30px] text-[#2A42A1]">EduBridge</h2>
            <p className="font-fredoka text-[11px] font-semibold leading-[15px] text-[#96CDF2]">
              Belajar Matematika<br />Raih Masa Depan
            </p>
          </div>
        </div>
        <nav className="relative z-10 flex-1 px-3 pt-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`mb-2 flex min-h-[52px] items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 transition-colors ${
                location.pathname === item.path
                  ? 'bg-[#F5FAFF] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center text-[#4C8CE2]">
                <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  {item.icon === 'home' && <path d="M5 21.5 24 5l19 16.5v21H29V29H19v13.5H5v-21Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />}
                  {item.icon === 'book' && <path d="M24 13c-5.8-4.4-12.1-4.7-19-2v28c6.9-2.7 13.2-2.4 19 2m0-28c5.8-4.4 12.1-4.7 19-2v28c-6.9-2.7-13.2-2.4-19 2m0-28v28" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />}
                  {item.icon === 'quiz' && <><path d="M15 27c0-6-7-8-7-15a16 16 0 0 1 32 0c0 7-7 9-7 15H15Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M17 33h14m-12 5h10M24 1v4M3 13h4m34 0h4M8 3l3 4m29-4-3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
                  {item.icon === 'progress' && <path d="m4 35 12-14 8 7L42 8m-11 0h11v11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                  {item.icon === 'profile' && <><circle cx="24" cy="15" r="9" stroke="currentColor" strokeWidth="2.8" /><path d="M5 43c0-10 7.5-16 19-16s19 6 19 16H5Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" /></>}
                </svg>
              </div>
              <span className={`font-poppins text-[15px] ${location.pathname === item.path ? 'font-extrabold text-[#3A81DA]' : 'font-semibold text-[#3A81DA]'}`}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
        <img src={sidebarMascot} alt="Maskot EduBridge memegang pensil" className="pointer-events-none absolute bottom-0 right-0 z-0 h-[200px] w-full object-contain object-bottom" />
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex min-h-[72px] items-center justify-between gap-4 bg-[#F3F6FB] px-4 sm:px-8">
          <div className="flex h-[48px] min-w-0 w-full max-w-[420px] items-center gap-3 rounded-[24px] border border-black bg-white px-3 sm:px-4">
            <svg className="shrink-0" width="22" height="22" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="13.75" cy="13.75" r="10" stroke="#666" strokeWidth="2"/>
              <path d="M21.25 21.25L26.25 26.25" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              aria-label="Cari materi, topik, atau kata kunci"
              placeholder="Cari materi, topik, atau kata kunci..."
              className="min-w-0 flex-1 outline-none font-poppins text-sm sm:text-base"
            />
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-6">
            <button type="button" aria-label="Notifikasi" className="relative">
              <svg width="32" height="32" viewBox="0 0 37 37" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.5 0C27.6127 0 35 7.3873 35 16.5C35 25.6127 27.6127 33 18.5 33C9.3873 33 2 25.6127 2 16.5C2 7.3873 9.3873 0 18.5 0Z" fill="url(#paint0_linear)"/>
                <circle cx="30.5" cy="12.5" r="6.5" fill="#EC1F22"/>
                <text x="30.5" y="16" textAnchor="middle" fill="white" fontSize="5" fontWeight="700">3</text>
                <defs>
                  <linearGradient id="paint0_linear" x1="18.5" y1="0" x2="18.5" y2="33" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFD45A"/>
                    <stop offset="1" stopColor="#FFB43A"/>
                  </linearGradient>
                </defs>
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <span className="font-poppins font-bold text-[16px] text-[#8A9AB0]">Nadia</span>
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5.5 9L10 1" stroke="#8A9AB0" strokeWidth="2"/>
              </svg>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
