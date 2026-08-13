import { FC } from 'react';

interface ContainerProps {
  children: React.ReactNode;
}

const Container: FC<ContainerProps> = ({ children }) => {
  return (
    <div className="flex h-[600px] w-[420px] flex-col overflow-hidden px-4 py-3">
      {children}
    </div>
  );
};

export default Container;
