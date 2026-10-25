const Button = ({ children, variant = 'primary', className = '', icon, ...props }) => {
  const baseStyles = 'flex items-center justify-center gap-2 font-fredoka font-normal rounded-[24px] transition-all duration-200';
  
  const variants = {
    primary: 'bg-[#3E75F6] text-white hover:bg-[#3366e6] shadow-sm',
    secondary: 'bg-white text-[#2A42A1] border border-gray-200 hover:bg-gray-50',
    outline: 'bg-transparent text-[#3E75F6] border border-[#3E75F6] hover:bg-[#3E75F6]/5',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
