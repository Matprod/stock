interface PageLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export const PageLayout = ({
  children,
  header,
  className = "flex flex-col items-center gap-y-8",
}: PageLayoutProps) => {
  return (
    <div className={className}>
      {header && <div className="flex flex-row justify-start w-full items-center">{header}</div>}
      {children}
    </div>
  );
};
