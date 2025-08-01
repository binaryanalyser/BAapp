import React from 'react';

const Toaster: React.FC = () => {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toast notifications would be rendered here */}
    </div>
  );
};

export default Toaster;

export { Toaster }