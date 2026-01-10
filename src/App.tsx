import { useEffect, useState } from 'react'
import { GameEngine } from './game/GameEngine'
import { Company } from './game/Company'
import { ResourceRegistry } from './game/ResourceRegistry'
import { FacilityRegistry } from './game/FacilityRegistry'
import { CityRegistry } from './game/CityRegistry'
import { CompanyActions } from './components/CompanyActions'
import { AdminMenu } from './components/AdminMenu'
import { RetailFacility } from './game/RetailFacility'
import { ProductionFacility } from './game/ProductionFacility'
import { StorageFacility } from './game/StorageFacility'

function App() {
  const [game, setGame] = useState<GameEngine | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ text: string; type: 'success' | 'error' | 'info' }>>([])
  const [autoTickInterval, setAutoTickInterval] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [, forceUpdate] = useState({})

  const addMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessages(prev => [...prev.slice(-19), { text, type }])
  }

  useEffect(() => {
    initializeGame()
    return () => {
      if (autoTickInterval) {
        clearInterval(autoTickInterval)
      }
    }
  }, [])

  const initializeGame = async () => {
    try {
      console.log('Attempting to load game from database...')
      const gameEngine = new GameEngine()
      const loadResult = await gameEngine.loadAll()

      if (loadResult.success) {
        const loadedCompanies = gameEngine.getCompanies()

        console.log(`✅ Game loaded from database (${loadedCompanies.length} companies)`)
        setGame(gameEngine)
        setCompanies(loadedCompanies)
        if (loadedCompanies.length > 0) {
          setSelectedCompanyId(loadedCompanies[0].id)
        }
        addMessage(`Game loaded: ${loadedCompanies.length} companies`, 'success')
      } else {
        console.log('No companies found in database')
        setGame(gameEngine)
        setCompanies([])
        addMessage('No companies found. Create companies in database.', 'info')
      }
    } catch (err) {
      console.error('Failed to initialize game:', err)
      addMessage('Failed to load game: ' + (err as Error).message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const processTick = async () => {
    if (!game) return
    try {
      await game.processTick(true)
      setCompanies(game.getCompanies())
      forceUpdate({})
      addMessage(`Tick ${game.getTickCount()} processed`, 'info')
    } catch (err) {
      addMessage('Error processing tick: ' + (err as Error).message, 'error')
    }
  }

  const toggleAutoTick = () => {
    if (autoTickInterval) {
      clearInterval(autoTickInterval)
      setAutoTickInterval(null)
      addMessage('Auto tick stopped', 'info')
    } else {
      const interval = window.setInterval(() => {
        processTick()
      }, 1000)
      setAutoTickInterval(interval)
      addMessage('Auto tick started with autosave', 'success')
    }
  }

  const reloadGame = async () => {
    if (autoTickInterval) {
      clearInterval(autoTickInterval)
      setAutoTickInterval(null)
    }
    setIsLoading(true)
    await initializeGame()
  }

  if (isLoading) {
    return <div className="container"><h1>Loading...</h1></div>
  }

  if (!game) {
    return <div className="container"><h1>Error: Game not initialized</h1></div>
  }

  const selectedCompany = companies.find(c => c.id === selectedCompanyId)
  const definitions = FacilityRegistry.getAllDefinitions()
  const resources = ResourceRegistry.getAll()
  const cities = CityRegistry.getAllCities()

  return (
    <div className="container">
      <h1>🎮 Trader Game 04</h1>

      <div className="controls">
        <div className="section-title">Game Controls</div>
        <div className="control-row">
          <button onClick={processTick} disabled={companies.length === 0}>⏭️ Process Tick</button>
          <button onClick={toggleAutoTick} disabled={companies.length === 0}>
            {autoTickInterval ? '⏸️ Stop Auto Tick' : '▶️ Auto Tick (1s)'}
          </button>
          <button onClick={reloadGame}>🔄 Reload Game</button>
          <button onClick={() => setShowAdmin(!showAdmin)} className="danger">
            {showAdmin ? '🛠️ Hide Admin' : '🛠️ Show Admin'}
          </button>
          <span style={{ color: '#9cdcfe', marginLeft: '10px' }}>
            Tick: {game.getTickCount()} | Companies: {companies.length}
          </span>
        </div>
      </div>

      {showAdmin && (
        <AdminMenu
          game={game}
          activeCompany={selectedCompany || null}
          onRefresh={reloadGame}
          onSelectCompany={setSelectedCompanyId}
        />
      )}

      {showInfo && (
        <>
          <div className="info-panel">
            <div className="section-title">🏭 Facilities</div>
            <div className="grid">
              {definitions.map((f: any) => (
                <div key={f.type}>{f.icon} {f.name} - ${f.cost}</div>
              ))}
            </div>
          </div>

          <div className="info-panel">
            <div className="section-title">📦 Resources</div>
            <div className="grid">
              {resources.map((r: any) => (
                <div key={r.id}>{r.icon} {r.name} - Weight: {r.weight}</div>
              ))}
            </div>
          </div>

          <div className="info-panel">
            <div className="section-title">🌍 Cities</div>
            <div className="grid">
              {cities.map((c: any) => (
                <div key={`${c.name}|${c.country}`}>{c.flag} {c.name}, {c.country} - Wealth: {c.wealth}</div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="message-log">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.type}`}>
            {msg.text}
          </div>
        ))}
      </div>

      <div className="grid-main">
        <div className="left-panel">
          {companies.length === 0 ? (
            <div className="empty-state">
              <p>No companies found in database.</p>
            </div>
          ) : (
            <>
              {companies.length > 1 && (
                <div className="controls">
                  <div className="section-title">Select Company</div>
                  <div className="control-row">
                    {companies.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCompanyId(c.id)}
                        className={selectedCompanyId === c.id ? '' : 'secondary'}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedCompany && (
                <>
                  <CompanyDisplay company={selectedCompany} game={game} />
                  <CompanyActions
                    company={selectedCompany}
                    game={game}
                    onAction={() => {
                      setCompanies(game.getCompanies())
                      forceUpdate({})
                    }}
                    onMessage={addMessage}
                  />
                </>
              )}
            </>
          )}
        </div>

        <div className="right-panel">
          <MarketDisplay game={game} />
          <DemandSalesDisplay game={game} companies={companies} />
        </div>
      </div>
    </div>
  )
}

function MarketDisplay({ game }: { game: GameEngine }) {
  const market = game.getMarket()
  const sellOffers = market.getAllSellOffers()
  const contracts = market.getAllContracts()
  const transfers = market.getAllInternalTransfers()

  return (
    <div className="info-panel">
      <div className="section-title">⚖️ Global Market</div>

      <div style={{ marginBottom: '15px' }}>
        <strong>Current Sell Offers:</strong>
        {sellOffers.length === 0 ? <p style={{ color: '#666' }}>None</p> : (
          <div style={{ fontSize: '11px', marginTop: '5px' }}>
            {sellOffers.map(o => {
              const res = ResourceRegistry.get(o.resource)
              return (
                <div key={o.id} style={{ padding: '2px 0' }}>
                  {res?.icon} {o.resource}: {o.amountInStock}/{o.amountAvailable} units @ ${o.pricePerUnit.toFixed(2)} ({o.sellerName})
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <strong>Active Contracts:</strong>
        {contracts.length === 0 ? <p style={{ color: '#666' }}>None</p> : (
          <div style={{ fontSize: '11px', marginTop: '5px' }}>
            {contracts.map(c => {
              const res = ResourceRegistry.get(c.resource)
              const status = c.lastFailedTick !== null ? '⚠️ FAILED' : '✅'
              return (
                <div key={c.id} style={{ padding: '2px 0' }}>
                  {status} {res?.icon} {c.amountPerTick}/tick @ ${c.pricePerUnit.toFixed(2)} ({c.sellerName} → {c.buyerName})
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <strong>Internal Transfers:</strong>
        {transfers.length === 0 ? <p style={{ color: '#666' }}>None</p> : (
          <div style={{ fontSize: '11px', marginTop: '5px' }}>
            {transfers.map(t => {
              const res = ResourceRegistry.get(t.resource)
              const status = t.lastFailedTick !== null ? '⚠️ FAILED' : '✅'
              return (
                <div key={t.id} style={{ padding: '2px 0' }}>
                  {status} {res?.icon} {t.amountPerTick}/tick ({t.fromFacilityName} → {t.toFacilityName})
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function DemandSalesDisplay({ game, companies }: { game: GameEngine; companies: Company[] }) {
  const cities = CityRegistry.getAllCities()

  return (
    <div className="info-panel">
      <div className="section-title">📊 City Demand & Retail</div>
      <div style={{ fontSize: '11px' }}>
        {cities.map(city => {
          // Get all retail facilities in this city
          const retailers: any[] = []
          companies.forEach(company => {
            company.facilities.forEach(f => {
              if (f.type === 'retail' && f.city.name === city.name) {
                retailers.push(f)
              }
            })
          })

          const report = city.getDemandSalesReport(retailers)
          if (retailers.length === 0) return null

          return (
            <div key={`${city.name}|${city.country}`} style={{ marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{city.flag} {city.name}</div>
              {Array.from(report.resources.entries()).map(([resId, data]: [string, any]) => {
                const res = ResourceRegistry.get(resId)
                return (
                  <div key={resId} style={{ marginLeft: '10px', marginTop: '5px' }}>
                    <div style={{ color: '#9cdcfe' }}>
                      {res?.icon} {resId.toUpperCase()}: Demand {data.totalSales.toFixed(1)}/{data.baseDemand.toFixed(1)} ({(data.fulfillmentRate * 100).toFixed(0)}%)
                    </div>
                    {data.retailers.map((r: any, i: number) => (
                      <div key={i} style={{ marginLeft: '15px', color: '#ce9178' }}>
                        • {r.facilityName}: {r.sales.toFixed(1)} units @ ${r.price.toFixed(2)} ({(r.marketShare * 100).toFixed(0)}% share)
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompanyDisplay({ company, game }: { company: Company; game: GameEngine }) {
  return (
    <div className="company-section">
      <div className="company-header">
        <span>{company.name}</span>
        <span className="balance">Balance: ${company.balance.toFixed(2)}</span>
      </div>

      <div className="section-title">🏭 Facilities ({company.facilities.length})</div>
      {company.facilities.length === 0 ? (
        <p style={{ color: '#666', padding: '10px 0' }}>No facilities yet</p>
      ) : (
        <div className="facility-list">
          {company.facilities.map(facility => {
            const definition = FacilityRegistry.get(facility.type)
            const requiredWorkers = facility.calculateRequiredWorkers()
            const inventory = Array.from(facility.inventory?.entries() || [])
              .filter(([_, amount]) => amount > 0)

            const sellingContracts = facility.getSellingContracts()
            const buyingContracts = facility.getBuyingContracts()

            return (
              <div key={facility.id} className="facility-item">
                <div className="facility-name">{definition?.icon} {facility.name}</div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: '#666', marginBottom: '5px' }}>
                  <span>ID: {facility.id.substring(0, 8)}</span>
                  <span>📍 {facility.city.flag} {facility.city.name}, {facility.city.country}</span>
                </div>

                <div className="facility-status">
                  <div className="stat-row">
                    <span className="stat-label">Size:</span>
                    <span className="stat-value">{facility.size}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Workers:</span>
                    <span className="stat-value">{facility.workers}/{requiredWorkers}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Effectivity:</span>
                    <span className="stat-value">{(facility.effectivity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Wage Cost:</span>
                    <span className="stat-value">${facility.getWagePerTick().toFixed(2)}/tick</span>
                  </div>
                  {facility.type === 'retail' && (
                    <div className="stat-row">
                      <span className="stat-label">Last Revenue:</span>
                      <span className="stat-value">${(facility as RetailFacility).revenue.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {facility.inventory && (
                  <div className="facility-inventory">
                    <strong>📦 Inventory ({facility.getTotalInventory().toFixed(1)}/{facility.getMaxInventoryCapacity()}):</strong>
                    {inventory.length === 0 ? (
                      <span style={{ marginLeft: '8px', color: '#666' }}>empty</span>
                    ) : (
                      <div style={{ marginTop: '3px' }}>
                        {inventory.map(([resId, amount]) => {
                          const res = ResourceRegistry.get(resId)
                          return (
                            <span key={resId} style={{ marginRight: '10px' }}>
                              {res?.icon} {amount.toFixed(1)}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* Flows */}
                    <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.8 }}>
                      {(facility as any).getNetFlow && (() => {
                        const netFlow = (facility as any).getNetFlow()
                        if (netFlow.size === 0) return null
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <strong>Net:</strong>
                            {(Array.from(netFlow.entries()) as [string, number][]).map(([resId, rate]) => {
                              const res = ResourceRegistry.get(resId as string)
                              const r = rate as number
                              const color = r >= 0 ? '#4ec9b0' : '#f48771'
                              return (
                                <span key={resId as string} style={{ color }}>
                                  {res?.icon} {r >= 0 ? '+' : ''}{r.toFixed(1)}/tick
                                </span>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Depletion */}
                    <div style={{ marginTop: '3px', fontSize: '10px' }}>
                      {(facility as any).getTicksUntilDepletion && (() => {
                        const netFlow = (facility as any).getNetFlow()
                        const warnings: any[] = []
                        netFlow.forEach((rate: number, resId: string) => {
                          if (rate < 0) {
                            const ticks = (facility as any).getTicksUntilDepletion(resId)
                            if (ticks !== null) {
                              const res = ResourceRegistry.get(resId)
                              warnings.push(<span key={resId} style={{ color: ticks < 10 ? '#f48771' : '#ce9178', marginRight: '8px' }}>{res?.icon} {ticks} ticks left</span>)
                            }
                          }
                        })
                        return warnings.length > 0 ? <div><strong>⚠️ Depletes:</strong> {warnings}</div> : null
                      })()}
                    </div>
                  </div>
                )}

                {(sellingContracts.length > 0 || buyingContracts.length > 0) && (
                  <div style={{ marginTop: '5px', fontSize: '10px', padding: '5px', background: '#252526', borderRadius: '4px' }}>
                    {sellingContracts.length > 0 && (
                      <div>
                        <strong style={{ color: '#4ec9b0' }}>Outgoing:</strong>
                        {sellingContracts.map(c => <div key={c.contractId}>• {c.amountPerTick}/tick {c.resource} @ ${c.pricePerUnit}</div>)}
                      </div>
                    )}
                    {buyingContracts.length > 0 && (
                      <div style={{ marginTop: '3px' }}>
                        <strong style={{ color: '#ce9178' }}>Incoming:</strong>
                        {buyingContracts.map(c => <div key={c.contractId}>• {c.amountPerTick}/tick {c.resource} @ ${c.pricePerUnit}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default App
