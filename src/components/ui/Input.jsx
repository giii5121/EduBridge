const Input = ({ label, icon, type = 'text', className = '', ...props }) => {
  return (
    <div className={`flex items-center gap-[17px] bg-white border border-[#97DDF1] rounded-[8px] px-[10px] py-[10px] h-[53px] ${className}`}>
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <input
        type={type}
        className="flex-1 outline-none font-poppins text-[15px] text-black placeholder:text-black/60"
        {...props}
      />
    </div>
  );
};

export default Input;
