import { FC } from 'react';
import { cn } from '../lib/utils.ts';

interface WholeContainerProps extends React.HTMLAttributes<HTMLDivElement>{
  children: React.ReactNode;
  className?: string;
}

const WholeContainer: FC<WholeContainerProps> = ({ children, className, ...props }) => {
  return (
    <div className={cn('relative inset-0 flex h-[600px] w-full justify-center overflow-hidden bg-background', className)} {...props}>
      {children}
    </div>
  );
};

export default WholeContainer;
