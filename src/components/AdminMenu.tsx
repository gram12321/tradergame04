import { useState } from 'react'
import { GameEngine } from '../game/GameEngine'
import { Company } from '../game/Company'
import { CompanyRepository } from '../database/CompanyRepository'
import { AdminFunctions } from '../game/adminFunctions'

interface AdminMenuProps {
      game: GameEngine;
      activeCompany: Company | null;
      onRefresh: () => void;
      onSelectCompany: (id: string) => void;
}

export function AdminMenu({ game, activeCompany, onRefresh, onSelectCompany }: AdminMenuProps) {
      const [newCompanyName, setNewCompanyName] = useState('')
      const [cheatAmount, setCheatAmount] = useState(100000)
      const [balanceInput, setBalanceInput] = useState(1000000)
      const [isWiping, setIsWiping] = useState(false)

      const handleCreateCompany = async () => {
            if (!newCompanyName.trim()) return
            const id = crypto.randomUUID()
            const company = game.addCompany(id, newCompanyName.trim())
            await company.save()
            setNewCompanyName('')
            onRefresh()
            onSelectCompany(id)
      }

      const handleWipeDatabase = async () => {
            if (!confirm('🚨 CRITICAL ACTION: Are you sure you want to delete ALL companies and facilities from the database? This cannot be undone.')) return

            setIsWiping(true)
            const result = await CompanyRepository.deleteAll()
            if (result.success) {
                  alert('All companies and facilities deleted.')
                  onRefresh()
            } else {
                  alert('Failed to wipe database: ' + result.error)
            }
            setIsWiping(false)
      }

      const handleCheatAdd = async () => {
            if (!activeCompany) return
            if (AdminFunctions.addBalance(activeCompany, cheatAmount)) {
                  await activeCompany.save()
                  onRefresh()
            }
      }

      const handleCheatSet = async () => {
            if (!activeCompany) return
            if (AdminFunctions.setBalance(activeCompany, balanceInput)) {
                  await activeCompany.save()
                  onRefresh()
            }
      }

      return (
            <div className="admin-menu info-panel" style={{
                  border: '2px solid #f44336',
                  background: 'rgba(244, 67, 54, 0.05)',
                  marginTop: '20px'
            }}>
                  <div className="section-title" style={{ color: '#f44336' }}>🛠️ Admin & Cheat Tools</div>

                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        {/* CREATE COMPANY */}
                        <div className="form-group">
                              <h4>🏢 Global: Create Company</h4>
                              <div className="form-row">
                                    <input
                                          type="text"
                                          value={newCompanyName}
                                          onChange={(e) => setNewCompanyName(e.target.value)}
                                          placeholder="Enter company name..."
                                          style={{ flex: 1 }}
                                    />
                                    <button onClick={handleCreateCompany} className="success">Create</button>
                              </div>
                        </div>

                        {/* BALANCE CHEATS */}
                        <div className="form-group">
                              <h4>💰 Cheats: {activeCompany ? activeCompany.name : 'Select a company'}</h4>
                              <div className="form-row">
                                    <label>Add Cash:</label>
                                    <input
                                          type="number"
                                          value={cheatAmount}
                                          onChange={(e) => setCheatAmount(Number(e.target.value))}
                                          style={{ width: '100px' }}
                                    />
                                    <button onClick={handleCheatAdd} className="secondary" disabled={!activeCompany}>Add</button>
                              </div>
                              <div className="form-row">
                                    <label>Set Cash:</label>
                                    <input
                                          type="number"
                                          value={balanceInput}
                                          onChange={(e) => setBalanceInput(Number(e.target.value))}
                                          style={{ width: '100px' }}
                                    />
                                    <button onClick={handleCheatSet} className="secondary" disabled={!activeCompany}>Set</button>
                              </div>
                        </div>

                        {/* DANGER ZONE */}
                        <div className="form-group">
                              <h4>⚠️ Danger Zone</h4>
                              <p style={{ fontSize: '0.8em', color: '#ff7875', marginBottom: '10px' }}>
                                    Warning: This will permanently erase the world state.
                              </p>
                              <button
                                    onClick={handleWipeDatabase}
                                    className="danger"
                                    disabled={isWiping}
                                    style={{ width: '100%', padding: '10px', fontWeight: 'bold' }}
                              >
                                    {isWiping ? 'Wiping Database...' : '🔥 Reset Database (Wipe All)'}
                              </button>
                        </div>
                  </div>
            </div>
      )
}
