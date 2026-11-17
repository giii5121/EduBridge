const Checkbox = ({ label, checked, onChange }) => {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative w-[20px] h-[20px]">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <div className="w-[20px] h-[20px] bg-[#2A42A1] rounded-[2px] peer-checked:bg-[#3E75F6]"></div>
        <svg
          className="absolute top-[2px] left-[2px] w-[16px] h-[16px] hidden peer-checked:block"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13.3334 4L6.00002 11.3333L2.66669 8"
            stroke="#F3F6FB"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="font-poppins text-[11px] text-[#2A42A1]">{label}</span>
    </label>
  );
};

export default Checkbox;
