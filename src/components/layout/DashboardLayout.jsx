import { Link, useLocation } from 'react-router-dom';

const DashboardLayout = ({ children }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: (
      <svg width="56" height="49" viewBox="0 0 56 49" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28.5 0L56 18.375V49H35V29.75H22V49H0V18.375L28.5 0Z" stroke={location.pathname === '/dashboard' ? '#3A81DA' : '#3A81DA'} strokeWidth="2" fill={location.pathname === '/dashboard' ? '#F5FAFF' : 'none'}/>
      </svg>
    ) },
    { path: '/katalog', label: 'Katalog Materi', icon: (
      <svg width="58" height="53" viewBox="0 0 58 53" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M29 0L58 14.875V38.875L29 53L0 38.875V14.875L29 0Z" stroke="#3A81DA" strokeWidth="2"/>
      </svg>
    ) },
    { path: '/kuis', label: 'Kuis', icon: (
      <svg width="58" height="67" viewBox="0 0 58 67" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M29 0L58 16.75V50.25L29 67L0 50.25V16.75L29 0Z" stroke="#3A81DA" strokeWidth="1.5"/>
      </svg>
    ) },
    { path: '/progres', label: 'Progres', icon: (
      <svg width="56" height="48" viewBox="0 0 56 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0H8V48H0V0ZM24 12H16V48H24V12ZM40 24H32V48H40V24ZM56 36H48V48H56V36Z" fill="#3A81DA"/>
      </svg>
    ) },
    { path: '/profil', label: 'Profil', icon: (
      <svg width="58" height="53" viewBox="0 0 58 53" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="29" cy="17" r="12" stroke="#3A81DA" strokeWidth="2"/>
        <path d="M4 47C4 36.5066 12.5066 28 23 28H35C45.4934 28 54 36.5066 54 47V49H4V47Z" stroke="#3A81DA" strokeWidth="2"/>
      </svg>
    ) },
  ];

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex">
      {/* Sidebar */}
      <aside className="w-[365px] bg-white h-screen sticky top-0 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <img src="/assets/images/logo-small.png" alt="EduBridge" className="w-[101px] h-[89px]" />
          <div>
            <h2 className="font-fredoka font-bold text-[48px] text-[#2A42A1] leading-[58px]">EduBridge</h2>
            <p className="font-fredoka font-semibold text-[24px] text-[#96CDF2] leading-[29px]">
              Belajar Matematika<br />Raih Masa Depan
            </p>
          </div>
        </div>
        <nav className="flex-1 p-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-5 px-6 py-4 rounded-[16px] mb-2 transition-colors ${
                location.pathname === item.path
                  ? 'bg-[#F5FAFF] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="w-[56px] h-[56px] flex items-center justify-center">
                {item.icon}
              </div>
              <span className={`font-poppins text-[24px] ${location.pathname === item.path ? 'font-extrabold text-[#3A81DA]' : 'font-semibold text-[#3A81DA]'}`}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-[112px] bg-transparent flex items-center justify-between px-8">
          <div className="flex items-center gap-4 bg-white rounded-[24px] border border-black px-6 py-3 w-[451px] h-[64px]">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="13.75" cy="13.75" r="10" stroke="#666" strokeWidth="2"/>
              <path d="M21.25 21.25L26.25 26.25" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Cari materi, topik, atau kata kunci..."
              className="flex-1 outline-none font-poppins text-[20px]"
            />
          </div>
          <div className="flex items-center gap-6">
            <button className="relative">
              <svg width="37" height="37" viewBox="0 0 37 37" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              <span className="font-poppins font-bold text-[20px] text-[#8A9AB0]">Nadia</span>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5.5 9L10 1" stroke="#8A9AB0" strokeWidth="2"/>
              </svg>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
