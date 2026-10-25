import DashboardLayout from '../../components/layout/DashboardLayout';

const Dashboard = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="relative bg-gradient-to-r from-[#D8E8F7] to-[#5CC3E8]/46 rounded-[28px] p-8 overflow-hidden h-[228px]">
          <div className="relative z-10">
            <h1 className="font-poppins font-bold text-[40px] text-[#2A42A1] mb-2">
              Halo, Nadia! 👋
            </h1>
            <p className="font-poppins text-[20px] text-[#2A42A1] mb-4">
              Yuk lanjutkan perjalanan matematikamu hari ini!
            </p>
            <div className="inline-flex items-center gap-2 bg-white rounded-[16px] px-6 py-3">
              <span>⭐</span>
              <span className="font-poppins font-semibold text-[14px] text-[#3A81DA]">
                Kamu hebat! Setiap langkah kecil adalah kemajuan besar 🩷
              </span>
            </div>
          </div>
          <img 
            src="/assets/images/welcome-illustration.png" 
            alt="Welcome" 
            className="absolute right-0 top-0 h-full"
          />
        </div>

        {/* Pre-Test and Post-Test */}
        <div className="grid grid-cols-2 gap-6">
          <div className="relative bg-gradient-to-br from-[#B8E0FF] to-[#7FCBFF] rounded-[28px] p-6 overflow-hidden h-[190px]">
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-poppins font-bold text-[36px] text-[#2A42A1]">Pre-Test</h2>
                <img src="/assets/images/test-icon.png" alt="" className="w-[72px] h-[72px]" />
              </div>
              <p className="font-poppins font-semibold text-[14px] text-[#2A42A1] mb-1">Cek Kemampuan Awal</p>
              <p className="font-poppins text-[12px] text-[#2A42A1] mb-4 max-w-[255px]">
                Pemetaan awal untuk mengetahui penguasaan materi dan learning gap-mu
              </p>
              <div className="inline-flex items-center gap-2 bg-white rounded-[24px] px-4 py-2 border border-black">
                <div className="w-[10px] h-[10px] bg-[#8D7DCB] rounded-full"></div>
                <span className="font-poppins font-extrabold text-[10px] text-[#8D7DCB]">Belum Dikerjakan</span>
              </div>
              <button className="ml-4 bg-[#3A81DA] text-white rounded-[24px] px-6 py-2 font-poppins font-medium text-[13px] hover:bg-[#2A42A1]">
                Mulai Pre-Test →
              </button>
            </div>
          </div>

          <div className="relative bg-gradient-to-br from-[#E8F4FF] to-[#D0E8FF] rounded-[28px] p-6 overflow-hidden h-[190px]">
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-poppins font-bold text-[36px] text-[#2A42A1]">Post-Test</h2>
                <img src="/assets/images/test-icon.png" alt="" className="w-[72px] h-[72px]" />
              </div>
              <p className="font-poppins font-semibold text-[14px] text-[#2A42A1] mb-1">Uji Penguasaan Materi</p>
              <p className="font-poppins text-[12px] text-[#2A42A1] mb-4 max-w-[223px]">
                Lihat seberapa jauh pemahamanmu setelah belajar.
              </p>
              <div className="inline-flex items-center gap-2 bg-white rounded-[24px] px-4 py-2 border border-black">
                <div className="w-[10px] h-[10px] bg-[#42C6B0] rounded-full"></div>
                <span className="font-poppins font-extrabold text-[10px] text-[#42C6B0]">Siap dikerjakan</span>
              </div>
              <button className="ml-4 bg-[#3A81DA] text-white rounded-[24px] px-6 py-2 font-poppins font-medium text-[13px] hover:bg-[#2A42A1]">
                Mulai Post-Test →
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Pengingat Belajar */}
          <div className="col-span-2 bg-[#FFD45A] rounded-[28px] p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src="/assets/images/reminder-icon.png" alt="" className="w-[78px] h-[71px]" />
                <h2 className="font-poppins font-bold text-[24px] text-[#2A42A1]">Pengingat Belajar</h2>
              </div>
              <button className="bg-[#3A81DA] text-white rounded-[24px] px-6 py-2 font-poppins font-extrabold text-[15px] flex items-center gap-2">
                Lihat Semua →
              </button>
            </div>
            <p className="font-poppins text-[15px] text-[#2A42A1] mb-4 ml-[90px]">
              Kamu punya 3 materi yang perlu dipelajari hari ini!
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white rounded-[8px] border border-black p-3">
                <div className="flex items-center gap-4">
                  <div className="w-[30px] h-[30px] bg-[#8D7DCB] rounded-[10px]"></div>
                  <span className="font-poppins font-semibold text-[16px] text-[#2A42A1]">Aljabar</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-[21px] h-[21px] bg-[#EC1F22] rounded-full"></div>
                  <span className="font-poppins font-semibold text-[12px] text-[#EC1F22]">10 menit lagi</span>
                </div>
              </div>
              <div className="flex items-center justify-between bg-white rounded-[8px] border border-black p-3">
                <div className="flex items-center gap-4">
                  <div className="w-[30px] h-[30px] bg-[#42C6B0] rounded-[10px]"></div>
                  <span className="font-poppins font-semibold text-[16px] text-[#2A42A1]">Persamaan Kuadrat</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-[24px] h-[24px] bg-[#FFB43A] rounded-full"></div>
                  <span className="font-poppins font-semibold text-[12px] text-[#FFB43A]">1 jam lagi</span>
                </div>
              </div>
              <div className="flex items-center justify-between bg-white rounded-[8px] border border-black p-3">
                <div className="flex items-center gap-4">
                  <div className="w-[27px] h-[26px] bg-[#F56F9B] rounded-[10px]"></div>
                  <span className="font-poppins font-semibold text-[16px] text-[#2A42A1]">Geometri</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-[24px] h-[24px] bg-[#0F58B3] rounded-full"></div>
                  <span className="font-poppins font-semibold text-[12px] text-[#0F58B3]">2 jam lagi</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progres Minggu Ini */}
          <div className="bg-white rounded-[28px] border border-[#8A9AB0] p-6">
            <div className="flex items-center gap-3 mb-4">
              <img src="/assets/images/chart-icon.png" alt="" className="w-[60px] h-[60px]" />
              <h2 className="font-poppins font-extrabold text-[20px] text-[#3A81DA]">Progres Minggu Ini</h2>
            </div>
            <div className="h-[200px] flex items-end justify-between gap-2 mt-8">
              {[40, 60, 45, 70, 55, 30, 50].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-[#3A81DA] rounded-t-lg" style={{ height: `${h}%` }}></div>
                  <span className="font-poppins text-[10px] text-[#2A42A1]">
                    {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Rekomendasi Belajar */}
          <div className="bg-white rounded-[28px] border border-[#8A9AB0] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src="/assets/images/target-icon.png" alt="" className="w-[60px] h-[60px]" />
                <div>
                  <h2 className="font-poppins font-bold text-[20px] text-[#2A42A1]">Rekomendasi Belajar Hari Ini</h2>
                  <p className="font-poppins text-[12px] text-[#2A42A1]">3 topik pilihan yang sesuai dengan penguasaanmu saat ini.</p>
                </div>
              </div>
              <button className="bg-[#3A81DA] text-white rounded-[24px] px-4 py-2 font-poppins font-bold text-[15px]">
                Lihat Semua
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-[#D8E8F7] rounded-[16px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] bg-[#8D7DCB] rounded-[10px]"></div>
                    <div>
                      <h3 className="font-poppins font-bold text-[15px] text-[#2A42A1]">Persamaan Kuadrat</h3>
                      <span className="inline-flex items-center gap-1 bg-white rounded-[24px] px-2 py-1 mt-1">
                        <div className="w-[10px] h-[10px] bg-[#FFD45A] rounded-full"></div>
                        <span className="font-poppins font-extrabold text-[14px] text-[#FFB43A]">Sedang berkembang</span>
                      </span>
                    </div>
                  </div>
                  <span className="font-poppins font-semibold text-[12px]">68%</span>
                </div>
                <div className="w-full bg-[#D9D9D9] rounded-full h-[22px]">
                  <div className="bg-[#FFD45A] h-[22px] rounded-full" style={{ width: '68%' }}></div>
                </div>
              </div>
              <div className="bg-[#D8E8F7] rounded-[16px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] bg-[#42C6B0] rounded-[10px]"></div>
                    <div>
                      <h3 className="font-poppins font-bold text-[15px] text-[#2A42A1]">Geometri</h3>
                      <span className="inline-flex items-center gap-1 bg-white rounded-[24px] px-2 py-1 mt-1">
                        <div className="w-[10px] h-[10px] bg-[#42C6B0] rounded-full"></div>
                        <span className="font-poppins font-extrabold text-[14px] text-[#42C6B0]">Sudah dikuasai</span>
                      </span>
                    </div>
                  </div>
                  <span className="font-poppins font-semibold text-[12px]">92%</span>
                </div>
                <div className="w-full bg-[#D9D9D9] rounded-full h-[22px]">
                  <div className="bg-[#42C6B0] h-[22px] rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>
              <div className="bg-[#D8E8F7] rounded-[16px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] bg-[#F56F9B] rounded-[10px]"></div>
                    <div>
                      <h3 className="font-poppins font-bold text-[15px] text-[#2A42A1]">Statistika</h3>
                      <span className="inline-flex items-center gap-1 bg-white rounded-[24px] px-2 py-1 mt-1">
                        <div className="w-[10px] h-[10px] bg-[#F56F9B] rounded-full"></div>
                        <span className="font-poppins font-extrabold text-[14px] text-[#F56F9B]">Perlu penguatan</span>
                      </span>
                    </div>
                  </div>
                  <span className="font-poppins font-semibold text-[12px]">42%</span>
                </div>
                <div className="w-full bg-[#D9D9D9] rounded-full h-[22px]">
                  <div className="bg-[#F56F9B] h-[22px] rounded-full" style={{ width: '42%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Tingkatan Materi */}
          <div className="bg-white rounded-[28px] border border-[#8A9AB0] p-6">
            <div className="flex items-center gap-3 mb-4">
              <img src="/assets/images/level-icon.png" alt="" className="w-[60px] h-[60px]" />
              <div className="flex-1">
                <h2 className="font-poppins font-bold text-[20px] text-[#2A42A1]">Tingkatkan Penguasaan Materi</h2>
              </div>
              <div className="bg-[#3A81DA] text-white rounded-[24px] px-4 py-2 flex items-center gap-2">
                <span className="font-poppins font-bold text-[15px]">75%</span>
                <span className="font-poppins font-bold text-[15px]">Rata-rata penguasaan</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="bg-[#D8E8F7] rounded-[16px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] bg-[#3A81DA] rounded-[10px]"></div>
                    <h3 className="font-poppins font-bold text-[20px] text-[#2A42A1]">Aljabar</h3>
                  </div>
                  <span className="font-poppins font-semibold text-[12px]">92%</span>
                </div>
                <div className="w-full bg-[#D9D9D9] rounded-full h-[22px]">
                  <div className="bg-[#3A81DA] h-[22px] rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>
              <div className="bg-[#D8E8F7] rounded-[16px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] bg-[#42C6B0] rounded-[10px]"></div>
                    <h3 className="font-poppins font-bold text-[20px] text-[#2A42A1]">Geometri</h3>
                  </div>
                  <span className="font-poppins font-semibold text-[12px]">78%</span>
                </div>
                <div className="w-full bg-[#D9D9D9] rounded-full h-[22px]">
                  <div className="bg-[#42C6B0] h-[22px] rounded-full" style={{ width: '78%' }}></div>
                </div>
              </div>
              <div className="bg-[#D8E8F7] rounded-[16px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] bg-[#F56F9B] rounded-[10px]"></div>
                    <h3 className="font-poppins font-bold text-[20px] text-[#2A42A1]">Statistika</h3>
                  </div>
                  <span className="font-poppins font-semibold text-[12px]">64%</span>
                </div>
                <div className="w-full bg-[#D9D9D9] rounded-full h-[22px]">
                  <div className="bg-[#F56F9B] h-[22px] rounded-full" style={{ width: '64%' }}></div>
                </div>
              </div>
              <div className="bg-[#D8E8F7] rounded-[16px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] bg-[#8D7DCB] rounded-[10px]"></div>
                    <h3 className="font-poppins font-bold text-[20px] text-[#2A42A1]">Kalkulus</h3>
                  </div>
                  <span className="font-poppins font-semibold text-[12px]">50%</span>
                </div>
                <div className="w-full bg-[#D9D9D9] rounded-full h-[22px]">
                  <div className="bg-[#8D7DCB] h-[22px] rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
