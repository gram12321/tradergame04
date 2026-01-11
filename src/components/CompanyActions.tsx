import { useState, useEffect } from 'react'
import { Company } from '../game/Company'
import { FacilityRegistry } from '../game/FacilityRegistry'
import { CityRegistry } from '../game/CityRegistry'
import { ResourceRegistry } from '../game/ResourceRegistry'
import { RecipeRegistry } from '../game/RecipeRegistry'
import { AdminFunctions } from '../game/adminFunctions'
import { ProductionFacility } from '../game/ProductionFacility'
import { StorageFacility } from '../game/StorageFacility'
import { RetailFacility } from '../game/RetailFacility'

interface CompanyActionsProps {
  company: Company
  game: any
  onAction: () => void
  onMessage: (text: string, type: 'success' | 'error' | 'info') => void
}

export function CompanyActions({ company, game, onAction, onMessage }: CompanyActionsProps) {
  const [activeTab, setActiveTab] = useState('create')

  // Form states - Create
  const [createType, setCreateType] = useState('farm')
  const [createCity, setCreateCity] = useState('Copenhagen|Denmark')

  // Form states - Transfer
  const [transferFrom, setTransferFrom] = useState(0)
  const [transferTo, setTransferTo] = useState(0)
  const [transferResource, setTransferResource] = useState('grain')
  const [transferAmount, setTransferAmount] = useState(1)

  // Form states - Internal Transfer
  const [internalFrom, setInternalFrom] = useState(0)
  const [internalTo, setInternalTo] = useState(0)
  const [internalResource, setInternalResource] = useState('grain')
  const [internalAmount, setInternalAmount] = useState(1)

  // Form states - Upgrade/Degrade
  const [upgradeFacility, setUpgradeFacility] = useState(0)
  const [degradeFacility, setDegradeFacility] = useState(0)

  // Form states - Workers
  const [workersFacility, setWorkersFacility] = useState(0)
  const [workersCount, setWorkersCount] = useState(1)

  // Form states - Sell Offer
  const [sellFacility, setSellFacility] = useState(0)
  const [sellResource, setSellResource] = useState('grain')
  const [sellAmount, setSellAmount] = useState(1)
  const [sellPrice, setSellPrice] = useState(1.0)

  // Form states - Contract
  const [contractOffer, setContractOffer] = useState('')
  const [contractFacility, setContractFacility] = useState(0)
  const [contractAmount, setContractAmount] = useState(1)

  // Form states - Retail Price
  const [retailFacility, setRetailFacility] = useState(0)
  const [retailResource, setRetailResource] = useState('bread')
  const [retailPrice, setRetailPrice] = useState(10.0)

  // Form states - Recipe
  const [recipeFacility, setRecipeFacility] = useState(0)
  const [recipeType, setRecipeType] = useState('')

  // Form states - Destroy
  const [destroyFacility, setDestroyFacility] = useState(0)


  // Focused Edit States
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState(0)
  const [editAmount, setEditAmount] = useState(0)

  const facilities = FacilityRegistry.getAllDefinitions()
  const cities = CityRegistry.getAllCities()
  const resources = ResourceRegistry.getAll()
  const facilitiesWithInventory = company.facilities.filter(f => f.type !== 'office' && f.type !== 'retail')
  const retailFacilities = company.facilities.filter(f => f.type === 'retail')
  const productionFacilities = company.facilities.filter(f => {
    const def = FacilityRegistry.get(f.type)
    return def && def.allowedRecipes && def.allowedRecipes.length > 0
  })

  // Effect to reset indices and defaults when company changes
  useEffect(() => {
    if (company.facilities.length > 0) {
      setWorkersCount(company.facilities[0].workers)
      setUpgradeFacility(0)
      setDegradeFacility(0)
      setWorkersFacility(0)
      setSellFacility(0)
      setContractFacility(0)
    }

    if (facilitiesWithInventory.length > 0) {
      setInternalFrom(0)
      setInternalTo(Math.min(1, facilitiesWithInventory.length - 1))
    }

    if (retailFacilities.length > 0) {
      const idx = company.facilities.indexOf(retailFacilities[0])
      setRetailFacility(idx)
    }

    if (productionFacilities.length > 0) {
      const idx = company.facilities.indexOf(productionFacilities[0])
      setRecipeFacility(idx)
      const def = FacilityRegistry.get(productionFacilities[0].type)
      if (def?.allowedRecipes?.length) {
        setRecipeType(def.allowedRecipes[0])
      }
    }
  }, [company.id, company.facilities.length])

  const handleCreateFacility = async () => {
    try {
      const facilityType = FacilityRegistry.get(createType)
      const [cityName, country] = createCity.split('|')
      const city = CityRegistry.getCity(cityName, country)

      if (!facilityType || !city) {
        onMessage('Invalid facility type or city', 'error')
        return
      }

      if (facilityType.category !== 'office' && !company.hasOfficeInCountry(country)) {
        onMessage('You must build an office in this country before creating other facilities.', 'error')
        return
      }

      if (facilityType.category === 'office' && company.hasOfficeInCountry(country)) {
        onMessage('You already have an office in this country.', 'error')
        return
      }

      const facility = company.createFacility(createType, city)
      if (!facility) {
        onMessage('Failed to create facility (check balance or requirements)', 'error')
        return
      }

      await company.save()
      onMessage(`Created ${facility.name} in ${city.name}`, 'success')
      onAction()
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleTransfer = async () => {
    try {
      if (company.facilities.length < 2) {
        onMessage('Need at least 2 facilities to transfer resources!', 'error')
        return
      }

      const from = company.facilities[transferFrom] as ProductionFacility | StorageFacility | RetailFacility
      const to = company.facilities[transferTo] as ProductionFacility | StorageFacility | RetailFacility

      if (!from || !to) {
        onMessage('Invalid facilities selected', 'error')
        return
      }

      const success = game.getContractSystem().executeInstantTransfer(company, from, to, transferResource, transferAmount)
      if (success) {
        await company.save()
        const resource = ResourceRegistry.get(transferResource)
        onMessage(`Transferred ${transferAmount} ${resource?.icon} ${transferResource} from ${from.name} to ${to.name}`, 'success')
        onAction()
      } else {
        onMessage('Transfer failed. Not enough resources?', 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleCreateInternalTransfer = async () => {
    try {
      const facilitiesWithInventory = company.facilities.filter(f => f.type !== 'office' && f.type !== 'retail')

      if (facilitiesWithInventory.length < 2) {
        onMessage('Need at least 2 facilities with inventory!', 'error')
        return
      }

      const from = facilitiesWithInventory[internalFrom] as ProductionFacility | StorageFacility
      const to = facilitiesWithInventory[internalTo] as ProductionFacility | StorageFacility

      if (!from || !to) {
        onMessage('Invalid facilities selected', 'error')
        return
      }

      const transfer = game.getContractSystem().executeCreateInternalTransfer(company, from, to, internalResource, internalAmount)
      if (transfer) {
        await company.save()
        await game.getContractSystem().save()
        const resource = ResourceRegistry.get(internalResource)
        onMessage(`Created internal transfer: ${internalAmount} ${resource?.icon} ${internalResource}/tick from ${from.name} to ${to.name}`, 'success')
        onAction()
      } else {
        // More specific error based on logic
        let reason = 'Creation failed'
        if (from.id === to.id) reason = 'Source and destination are the same'
        else if (from.type !== 'warehouse' && to.type !== 'warehouse') reason = 'At least one facility must be a warehouse'
        else if (!(from instanceof ProductionFacility || from instanceof StorageFacility)) reason = 'Source facility invalid type'

        onMessage(`Internal transfer failed: ${reason}`, 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleUpgrade = async () => {
    try {
      const facility = company.facilities[upgradeFacility]
      if (!facility) {
        onMessage('No facility selected', 'error')
        return
      }

      const oldSize = facility.size
      const cost = facility.getUpgradeCost()

      const success = company.upgradeFacility(facility)
      if (success) {
        await company.save()
        onMessage(`Upgraded ${facility.name}! Size ${oldSize}→${facility.size}, Cost: $${cost.toFixed(2)}`, 'success')
        onAction()
      } else {
        onMessage(`Upgrade failed. Need $${cost.toFixed(2)}`, 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleDegrade = async () => {
    try {
      const facility = company.facilities[degradeFacility]
      if (!facility) {
        onMessage('No facility selected', 'error')
        return
      }

      if (facility.size <= 1) {
        onMessage('Cannot degrade: Already at minimum size (1)', 'error')
        return
      }

      const oldSize = facility.size
      const refund = facility.getDegradeCost()

      const success = company.degradeFacility(facility)
      if (success) {
        await company.save()
        onMessage(`Degraded ${facility.name}! Size ${oldSize}→${facility.size}, Refund: $${refund.toFixed(2)}`, 'info')
        onAction()
      } else {
        onMessage('Degrade failed', 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleSetWorkers = async () => {
    try {
      const facility = company.facilities[workersFacility]
      if (!facility) {
        onMessage('No facility selected', 'error')
        return
      }

      const oldWorkers = facility.workers
      const success = company.setFacilityWorkers(facility, workersCount)

      if (success) {
        await company.save()
        const diff = workersCount - oldWorkers
        const action = diff > 0 ? 'Hired' : 'Fired'
        onMessage(`${action} ${Math.abs(diff)} workers at ${facility.name}! Workers: ${oldWorkers}→${facility.workers}`, 'success')
        onAction()
      } else {
        onMessage('Failed to set worker count. Insufficient balance?', 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleCreateSellOffer = async () => {
    try {
      const facility = company.facilities[sellFacility] as ProductionFacility | StorageFacility
      if (!facility) {
        onMessage('No facility selected', 'error')
        return
      }

      const offer = game.getContractSystem().executeCreateSellOffer(company, facility, sellResource, sellAmount, sellPrice)
      if (offer) {
        await company.save()
        await game.getContractSystem().save()
        const resource = ResourceRegistry.get(sellResource)
        onMessage(`Created sell offer: ${sellAmount} ${resource?.icon} ${sellResource}/tick @ $${sellPrice.toFixed(2)}/unit`, 'success')
        onAction()
      } else {
        onMessage('Sell offer creation failed!', 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleCreateContract = async () => {
    try {
      const facility = company.facilities[contractFacility]
      if (!facility) {
        onMessage('No facility selected', 'error')
        return
      }

      const market = game.getContractSystem()
      const offer = market.getSellOffer(contractOffer)

      if (!offer) {
        onMessage('Invalid sell offer selected', 'error')
        return
      }

      // Find the other company
      const allCompanies = game.getCompanies()
      const otherCompany = allCompanies.find((c: Company) => c.id === offer.sellerId)

      if (!otherCompany) {
        onMessage('Seller company not found', 'error')
        return
      }

      const contract = market.executeAcceptSellOffer(company, otherCompany, offer.id, facility as ProductionFacility | StorageFacility, contractAmount)

      if (contract) {
        await company.save()
        await otherCompany.save()
        await market.save()
        const resource = ResourceRegistry.get(contract.resource)
        onMessage(`Created contract: ${contractAmount} ${resource?.icon} ${contract.resource}/tick @ $${contract.pricePerUnit.toFixed(2)}/unit`, 'success')
        onAction()
      } else {
        let reason = 'Creation failed'
        if (offer.sellerId === company.id) reason = 'Cannot buy from yourself'
        else if (offer.amountAvailable < contractAmount) reason = 'Insufficient supply available'
        onMessage(`Contract failed: ${reason}`, 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleSetRetailPrice = async () => {
    try {
      const facility = company.facilities[retailFacility]
      if (facility instanceof RetailFacility) {
        facility.setPrice(retailResource, retailPrice)
        await company.save()
        onMessage(`✅ Set ${retailResource} price to $${retailPrice.toFixed(2)} at ${facility.name}`, 'success')
        onAction()
      } else {
        onMessage('Not a retail facility', 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleChangeRecipe = async () => {
    try {
      const facility = company.facilities[recipeFacility]
      const recipe = RecipeRegistry.get(recipeType)
      if (facility instanceof ProductionFacility && recipe) {
        facility.setRecipe(recipe)
        await company.save()
        onMessage(`✅ Changed recipe at ${facility.name} to ${recipeType}`, 'success')
        onAction()
      } else {
        onMessage('Invalid recipe or facility', 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }

  const handleDestroy = async () => {
    try {
      const facility = company.facilities[destroyFacility]
      if (!facility) {
        onMessage('No facility selected', 'error')
        return
      }

      if (!confirm(`⚠️ Are you sure you want to destroy ${facility.name}? This action is permanent!`)) {
        return
      }

      const facilityName = facility.name
      const success = company.destroyFacility(facility)

      if (success) {
        await company.save()
        onMessage(`Destroyed ${facilityName}`, 'info')
        onAction()
      } else {
        onMessage('Failed to destroy facility', 'error')
      }
    } catch (err) {
      onMessage(`Error: ${(err as Error).message}`, 'error')
    }
  }


  const handleCancelSellOffer = async (id: string) => {
    if (!confirm('Cancel this sell offer?')) return
    const success = game.getContractSystem().executeCancelSellOffer(company, id)
    if (success) {
      await company.save()
      await game.getContractSystem().save()
      onMessage('Sell offer canceled', 'info')
      onAction()
    }
  }

  const handleUpdateSellOffer = async (id: string) => {
    const success = game.getContractSystem().executeUpdateSellOffer(company, id, editPrice, editAmount)
    if (success) {
      await company.save()
      await game.getContractSystem().save()
      onMessage('Sell offer updated', 'success')
      setEditingId(null)
      onAction()
    }
  }

  const handleCancelContract = async (id: string) => {
    if (!confirm('Cancel this contract?')) return

    const market = game.getContractSystem()
    const contract = market.getContract(id)
    if (!contract) return

    // Find the other company involved
    const otherCompanyId = contract.sellerId === company.id ? contract.buyerId : contract.sellerId
    const otherCompany = game.getCompanies().find((c: any) => c.id === otherCompanyId)

    const success = market.executeCancelContract(id, company, otherCompany)
    if (success) {
      await company.save()
      if (otherCompany) await otherCompany.save()
      await market.save()
      onMessage('Contract canceled', 'info')
      onAction()
    }
  }

  const handleUpdateContract = async (id: string, isSeller: boolean) => {
    let success = false
    const market = game.getContractSystem()
    if (isSeller) {
      success = market.executeUpdateContractPrice(id, company, editPrice)
    } else {
      success = market.executeUpdateContractAmount(id, company, editAmount)
    }

    if (success) {
      await company.save()
      await market.save()
      onMessage('Contract updated', 'success')
      setEditingId(null)
      onAction()
    }
  }

  const handleCancelInternalTransfer = async (id: string) => {
    if (!confirm('Cancel this internal transfer?')) return
    const success = game.getContractSystem().executeCancelInternalTransfer(id, company)
    if (success) {
      await company.save()
      await game.getContractSystem().save()
      onMessage('Internal transfer canceled', 'info')
      onAction()
    }
  }

  const handleUpdateInternalTransfer = async (id: string) => {
    const success = game.getContractSystem().executeUpdateInternalTransferAmount(id, company, editAmount)
    if (success) {
      await company.save()
      await game.getContractSystem().save()
      onMessage('Internal transfer updated', 'success')
      setEditingId(null)
      onAction()
    }
  }


  // Get available sell offers from market
  const market = game?.getContractSystem()
  const availableOffers = market?.getAvailableSellOffers() || []

  return (
    <div className="controls">
      <div className="section-title">{company.name} Actions</div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
          🏭 Create
        </button>
        <button className={`tab ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}>
          ⚙️ Manage
        </button>
        <button className={`tab ${activeTab === 'trade' ? 'active' : ''}`} onClick={() => setActiveTab('trade')}>
          📦 Trade
        </button>
      </div>

      {/* CREATE TAB */}
      <div className={`tab-content ${activeTab === 'create' ? 'active' : ''}`}>
        <div className="form-group">
          <div className="form-row">
            <label>Facility Type:</label>
            <select value={createType} onChange={(e) => setCreateType(e.target.value)}>
              {facilities.map((f) => (
                <option key={f.type} value={f.type}>{f.icon} {f.name} (${f.cost})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>City:</label>
            <select value={createCity} onChange={(e) => setCreateCity(e.target.value)}>
              {cities.map((c) => (
                <option key={`${c.name}|${c.country}`} value={`${c.name}|${c.country}`}>
                  {c.flag} {c.name}, {c.country} (wealth {c.wealth})
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button onClick={handleCreateFacility}>Build Facility</button>
          </div>
        </div>
      </div>

      {/* MANAGE TAB */}
      <div className={`tab-content ${activeTab === 'manage' ? 'active' : ''}`}>
        <div className="form-group">
          <h4>Transfer Resources (Instant)</h4>
          {company.facilities.length >= 2 ? (
            <>
              <div className="form-row">
                <label>From:</label>
                <select value={transferFrom} onChange={(e) => setTransferFrom(Number(e.target.value))}>
                  {company.facilities.map((f, i) => (
                    <option key={f.id} value={i}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>To:</label>
                <select value={transferTo} onChange={(e) => setTransferTo(Number(e.target.value))}>
                  {company.facilities.map((f, i) => (
                    <option key={f.id} value={i}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Resource:</label>
                <select value={transferResource} onChange={(e) => setTransferResource(e.target.value)}>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Amount:</label>
                <input type="number" min="1" value={transferAmount} onChange={(e) => setTransferAmount(Number(e.target.value))} />
              </div>
              <button onClick={handleTransfer}>Transfer</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>Need at least 2 facilities</p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Create Internal Transfer (Recurring)</h4>
          {facilitiesWithInventory.length >= 2 ? (
            <>
              <div className="form-row">
                <label>From:</label>
                <select value={internalFrom} onChange={(e) => setInternalFrom(Number(e.target.value))}>
                  {facilitiesWithInventory.map((f, i) => (
                    <option key={f.id} value={i}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>To:</label>
                <select value={internalTo} onChange={(e) => setInternalTo(Number(e.target.value))}>
                  {facilitiesWithInventory.map((f, i) => (
                    <option key={f.id} value={i}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Resource:</label>
                <select value={internalResource} onChange={(e) => setInternalResource(e.target.value)}>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Amount/tick:</label>
                <input type="number" min="1" value={internalAmount} onChange={(e) => setInternalAmount(Number(e.target.value))} />
              </div>
              <button onClick={handleCreateInternalTransfer}>Create Transfer</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>Need at least 2 facilities with inventory</p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Upgrade Facility</h4>
          {company.facilities.length > 0 ? (
            <>
              <div className="form-row">
                <label>Facility:</label>
                <select value={upgradeFacility} onChange={(e) => setUpgradeFacility(Number(e.target.value))}>
                  {company.facilities.map((f, i) => (
                    <option key={f.id} value={i}>{f.name} (Size {f.size})</option>
                  ))}
                </select>
              </div>
              <button onClick={handleUpgrade}>Upgrade</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>No facilities</p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Degrade Facility</h4>
          {company.facilities.length > 0 ? (
            <>
              <div className="form-row">
                <label>Facility:</label>
                <select value={degradeFacility} onChange={(e) => setDegradeFacility(Number(e.target.value))}>
                  {company.facilities.map((f, i) => (
                    <option key={f.id} value={i}>{f.name} (Size {f.size})</option>
                  ))}
                </select>
              </div>
              <button onClick={handleDegrade}>Degrade (50% Refund)</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>No facilities</p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Hire/Fire Workers</h4>
          {company.facilities.length > 0 ? (
            <>
              <div className="form-row">
                <label>Facility:</label>
                <select value={workersFacility} onChange={(e) => {
                  const idx = Number(e.target.value)
                  setWorkersFacility(idx)
                  setWorkersCount(company.facilities[idx]?.workers || 1)
                }}>
                  {company.facilities.map((f, i) => (
                    <option key={f.id} value={i}>{f.name} ({f.workers} workers)</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Workers: {workersCount}</label>
                <input
                  type="range"
                  min="0"
                  max={company.facilities[workersFacility] ? company.facilities[workersFacility].calculateRequiredWorkers() * 10 : 10}
                  value={workersCount}
                  onChange={(e) => setWorkersCount(Number(e.target.value))}
                />
              </div>
              <button onClick={handleSetWorkers}>Set Workers</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>No facilities</p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Active Internal Transfers</h4>
          {(() => {
            const transfers = game.getContractSystem().getAllInternalTransfers().filter((t: any) => t.ownerId === company.id)
            if (transfers.length === 0) return <p style={{ color: '#666' }}>No active internal transfers</p>
            return (
              <div style={{ fontSize: '12px' }}>
                {transfers.map((t: any) => {
                  const res = ResourceRegistry.get(t.resource)
                  return (
                    <div key={t.id} style={{ padding: '8px', background: '#1e1e1e', border: '1px solid #333', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>{res?.icon} {t.resource}: {t.fromFacilityName} → {t.toFacilityName}</span>
                        <strong>{t.amountPerTick}/tick</strong>
                      </div>
                      {editingId === t.id ? (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <input type="number" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} style={{ width: '80px' }} />
                          <button onClick={() => handleUpdateInternalTransfer(t.id)}>Save</button>
                          <button onClick={() => setEditingId(null)} className="secondary">Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button onClick={() => {
                            setEditingId(t.id)
                            setEditAmount(t.amountPerTick)
                          }} className="secondary">Edit</button>
                          <button onClick={() => handleCancelInternalTransfer(t.id)} className="danger">Cancel Transfer</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Set Retail Price</h4>
          {retailFacilities.length > 0 ? (
            <>
              <div className="form-row">
                <label>Retail Facility:</label>
                <select value={retailFacility} onChange={(e) => setRetailFacility(Number(e.target.value))}>
                  {retailFacilities.map((f) => {
                    const idx = company.facilities.indexOf(f)
                    return <option key={f.id} value={idx}>{f.name} ({f.city.name})</option>
                  })}
                </select>
              </div>
              <div className="form-row">
                <label>Resource:</label>
                <select value={retailResource} onChange={(e) => setRetailResource(e.target.value)}>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Price/unit:</label>
                <input type="number" min="0" step="0.01" value={retailPrice} onChange={(e) => setRetailPrice(Number(e.target.value))} />
              </div>
              <button onClick={handleSetRetailPrice}>Set Price</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>No retail facilities</p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Change Recipe</h4>
          {productionFacilities.length > 0 ? (
            <>
              <div className="form-row">
                <label>Facility:</label>
                <select value={recipeFacility} onChange={(e) => {
                  const idx = Number(e.target.value)
                  setRecipeFacility(idx)
                  const facility = company.facilities[idx]
                  const def = FacilityRegistry.get(facility?.type)
                  if (def?.allowedRecipes && def.allowedRecipes.length > 0) {
                    setRecipeType(def.allowedRecipes[0])
                  }
                }}>
                  {productionFacilities.map((f) => {
                    const idx = company.facilities.indexOf(f)
                    const fProd = f as ProductionFacility
                    return <option key={f.id} value={idx}>{f.name} ({fProd.recipe?.name || 'No recipe'})</option>
                  })}
                </select>
              </div>
              <div className="form-row">
                <label>Recipe:</label>
                <select value={recipeType} onChange={(e) => setRecipeType(e.target.value)}>
                  {(() => {
                    const facility = company.facilities[recipeFacility]
                    const def = FacilityRegistry.get(facility?.type)
                    return def?.allowedRecipes?.map((recipeName: string) => (
                      <option key={recipeName} value={recipeName}>{recipeName}</option>
                    )) || []
                  })()}
                </select>
              </div>
              <button onClick={handleChangeRecipe}>Change Recipe</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>No facilities with multiple recipes</p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Destroy Facility</h4>
          {company.facilities.length > 0 ? (
            <>
              <div className="form-row">
                <label>Facility:</label>
                <select value={destroyFacility} onChange={(e) => setDestroyFacility(Number(e.target.value))}>
                  {company.facilities.map((f, i) => (
                    <option key={f.id} value={i}>{f.name} ({f.type}, {f.city.name})</option>
                  ))}
                </select>
              </div>
              <button onClick={handleDestroy} style={{ backgroundColor: '#f48771' }}>⚠️ Destroy (Permanent)</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>No facilities</p>
          )}
        </div>
      </div>

      {/* TRADE TAB */}
      <div className={`tab-content ${activeTab === 'trade' ? 'active' : ''}`}>
        <div className="form-group">
          <h4>Create Sell Offer</h4>
          {company.facilities.length > 0 ? (
            <>
              <div className="form-row">
                <label>From Facility:</label>
                <select value={sellFacility} onChange={(e) => setSellFacility(Number(e.target.value))}>
                  {company.facilities.map((f, i) => (
                    <option key={f.id} value={i}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Resource:</label>
                <select value={sellResource} onChange={(e) => setSellResource(e.target.value)}>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Amount/tick:</label>
                <input type="number" min="1" value={sellAmount} onChange={(e) => setSellAmount(Number(e.target.value))} />
              </div>
              <div className="form-row">
                <label>Price/unit:</label>
                <input type="number" min="0.01" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(Number(e.target.value))} />
              </div>
              <button onClick={handleCreateSellOffer}>Create Sell Offer</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>No facilities</p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>Create Buy Contract</h4>
          {availableOffers.length > 0 && company.facilities.length > 0 ? (
            <>
              <div className="form-row">
                <label>Sell Offer:</label>
                <select value={contractOffer} onChange={(e) => setContractOffer(e.target.value)}>
                  <option value="">Select an offer...</option>
                  {availableOffers.map((offer: any) => {
                    const resource = ResourceRegistry.get(offer.resource)
                    return (
                      <option key={offer.id} value={offer.id}>
                        {resource?.icon} {offer.resource}: {offer.amountInStock}/tick @ ${offer.pricePerUnit.toFixed(2)} ({offer.sellerName})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="form-row">
                <label>To Facility:</label>
                <select value={contractFacility} onChange={(e) => setContractFacility(Number(e.target.value))}>
                  {company.facilities.map((f, i) => (
                    <option key={f.id} value={i}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Amount/tick:</label>
                <input type="number" min="1" value={contractAmount} onChange={(e) => setContractAmount(Number(e.target.value))} />
              </div>
              <button onClick={handleCreateContract}>Create Contract</button>
            </>
          ) : (
            <p style={{ color: '#666' }}>
              {availableOffers.length === 0 ? 'No sell offers available' : 'No facilities to receive resources'}
            </p>
          )}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>My Sell Offers</h4>
          {(() => {
            const offers = game.getContractSystem().getAllSellOffers().filter((o: any) => o.sellerId === company.id)
            if (offers.length === 0) return <p style={{ color: '#666' }}>No active sell offers</p>
            return (
              <div style={{ fontSize: '12px' }}>
                {offers.map((o: any) => {
                  const res = ResourceRegistry.get(o.resource)
                  return (
                    <div key={o.id} style={{ padding: '8px', background: '#1e1e1e', border: '1px solid #333', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>{res?.icon} {o.resource} @ <strong>${o.pricePerUnit.toFixed(2)}</strong></span>
                        <span>Stock: {o.amountInStock}/{o.amountAvailable}</span>
                      </div>
                      {editingId === o.id ? (
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <label>Price:</label>
                          <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} style={{ width: '70px' }} />
                          <label>Amount:</label>
                          <input type="number" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} style={{ width: '70px' }} />
                          <button onClick={() => handleUpdateSellOffer(o.id)}>Save</button>
                          <button onClick={() => setEditingId(null)} className="secondary">Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button onClick={() => {
                            setEditingId(o.id)
                            setEditPrice(o.pricePerUnit)
                            setEditAmount(o.amountAvailable)
                          }} className="secondary">Edit</button>
                          <button onClick={() => handleCancelSellOffer(o.id)} className="danger">Cancel Offer</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <hr style={{ margin: '20px 0', border: '1px solid #3e3e42' }} />

          <h4>My Contracts (Buying & Selling)</h4>
          {(() => {
            const contracts = game.getContractSystem().getAllContracts().filter((c: any) => c.sellerId === company.id || c.buyerId === company.id)
            if (contracts.length === 0) return <p style={{ color: '#666' }}>No active contracts</p>
            return (
              <div style={{ fontSize: '12px' }}>
                {contracts.map((c: any) => {
                  const res = ResourceRegistry.get(c.resource)
                  const isSeller = c.sellerId === company.id
                  return (
                    <div key={c.id} style={{ padding: '8px', background: '#1e1e1e', border: '1px solid #333', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>{isSeller ? '📤 Selling' : '📥 Buying'} {res?.icon} {c.resource}</span>
                        <strong>{c.amountPerTick}/tick @ ${c.pricePerUnit.toFixed(2)}</strong>
                      </div>
                      <div style={{ color: '#666', fontSize: '10px', marginBottom: '5px' }}>
                        {isSeller ? `To: ${c.buyerName}` : `From: ${c.sellerName}`}
                      </div>
                      {editingId === c.id ? (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {isSeller ? (
                            <>
                              <label>New Price:</label>
                              <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} style={{ width: '70px' }} />
                            </>
                          ) : (
                            <>
                              <label>New Amount:</label>
                              <input type="number" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} style={{ width: '70px' }} />
                            </>
                          )}
                          <button onClick={() => handleUpdateContract(c.id, isSeller)}>Save</button>
                          <button onClick={() => setEditingId(null)} className="secondary">Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button onClick={() => {
                            setEditingId(c.id)
                            setEditPrice(c.pricePerUnit)
                            setEditAmount(c.amountPerTick)
                          }} className="secondary">Edit</button>
                          <button onClick={() => handleCancelContract(c.id)} className="danger">Cancel Contract</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

    </div>
  )
}
