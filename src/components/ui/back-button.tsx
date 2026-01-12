import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon } from "lucide-react";

interface BackButtonProps {
  title: string;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export const BackButton = ({
  title,
  to,
  onClick,
  className = "flex flex-row gap-x-2 items-center w-fit hover:opacity-80 transition-opacity",
}: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      <ChevronLeftIcon className="w-8 h-8" />
      <p className="text-2xl font-medium">{title}</p>
    </button>
  );
};
