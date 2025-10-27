"use client"

// src/components/features/TopGainersCard.jsx
import { ArrowUpIcon } from "@heroicons/react/24/solid"
import SkeletonLoader from "../common/SkeletonLoader"
import "../../styles/TopGainersCard.css"

const TopGainersCard = ({ gainers = [], onCryptoClick, isLoading }) => {
  if (isLoading) {
    return (
      <div className="gainers-card">
        <div className="gainers-card-header">
          <ArrowUpIcon className="gainers-card-icon" />
          <h3>Top Ganadores</h3>
        </div>
        <div className="gainers-card-list">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="gainers-card-item">
              <SkeletonLoader type="circle" width="32px" height="32px" />
              <div className="gainers-card-info">
                <SkeletonLoader type="text" width="50px" />
                <SkeletonLoader type="text" width="70px" />
              </div>
              <SkeletonLoader type="text" width="60px" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!gainers || gainers.length === 0) {
    return null
  }

  return (
    <div className="gainers-card">
      <div className="gainers-card-header">
        <ArrowUpIcon className="gainers-card-icon" />
        <h3>Top Ganadores (24hs)</h3>
      </div>
      <div className="gainers-card-list">
        {gainers.slice(0, 5).map((coin) => (
          <div key={coin.id} className="gainers-card-item" onClick={() => onCryptoClick?.(coin.symbol.toUpperCase())}>
            <img src={coin.image || "/placeholder.svg"} alt={coin.name} className="gainers-card-coin-icon" />
            <div className="gainers-card-info">
              <span className="gainers-card-symbol">{coin.symbol.toUpperCase()}</span>
              <span className="gainers-card-price">${coin.current_price.toFixed(2)}</span>
            </div>
            <span className="gainers-card-change">+{coin.changePercentage.toFixed(2)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TopGainersCard
