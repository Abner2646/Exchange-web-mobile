// src/components/common/SkeletonLoader.jsx
import '../../styles/SkeletonLoader.css';

const SkeletonLoader = ({ type = 'text', width, height, count = 1, className = '' }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'circle':
        return <div className={`skeleton skeleton-circle ${className}`} style={{ width, height }} />;
      
      case 'card':
        return (
          <div className={`skeleton skeleton-card ${className}`}>
            <div className="skeleton-card-header">
              <div className="skeleton skeleton-text skeleton-text-medium"></div>
              <div className="skeleton skeleton-text skeleton-text-short"></div>
            </div>
            <div className="skeleton-card-body">
              <div className="skeleton skeleton-text skeleton-text-long"></div>
              <div className="skeleton skeleton-text skeleton-text-medium"></div>
            </div>
          </div>
        );
      
      case 'balance-card':
        return (
          <div className={`skeleton skeleton-balance-card ${className}`}>
            <div className="skeleton skeleton-text skeleton-text-short"></div>
            <div className="skeleton skeleton-balance-amount"></div>
            <div className="skeleton skeleton-text skeleton-text-medium"></div>
            <div className="skeleton-balance-actions">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton skeleton-button"></div>
              ))}
            </div>
          </div>
        );
      
      case 'asset-item':
        return (
          <div className={`skeleton skeleton-asset-item ${className}`}>
            <div className="skeleton-asset-header">
              <div className="skeleton skeleton-text skeleton-text-short"></div>
              <div className="skeleton skeleton-text skeleton-text-short"></div>
            </div>
            <div className="skeleton skeleton-bar"></div>
            <div className="skeleton skeleton-text skeleton-text-short"></div>
          </div>
        );
      
      case 'text':
      default:
        return (
          <div 
            className={`skeleton skeleton-text ${className}`} 
            style={{ width, height }} 
          />
        );
    }
  };

  if (count === 1) {
    return renderSkeleton();
  }

  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i}>{renderSkeleton()}</div>
      ))}
    </>
  );
};

export default SkeletonLoader;