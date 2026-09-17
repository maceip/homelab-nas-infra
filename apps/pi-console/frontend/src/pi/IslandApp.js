import React, { useState } from 'react'
import PiApp from './PiApp'
import IslandOverview from './IslandOverview'
import leafArt from '../vendor/animal-island/assets/img/icons/icon-leaf.png'
import { Button } from '../vendor/animal-island/Button/Button'
import '../vendor/animal-island/tokens.css'
import './island.css'
import './files.css'

export default function IslandApp() {
  const [island, setIsland] = useState(() => { try { return localStorage.getItem('pi-design') !== 'spr' } catch { return true } })
  const select = enabled => { setIsland(enabled); try { localStorage.setItem('pi-design', enabled ? 'island' : 'spr') } catch {} }
  const appearance = <section className="island-design-picker"><h2>Make yourself at home</h2><p>Choose the new island look or the original SPR interface.</p><div><Button aria-pressed={island} type={island ? 'primary' : 'default'} onClick={() => select(true)}>Island & glass</Button><Button aria-pressed={!island} type={!island ? 'primary' : 'default'} onClick={() => select(false)}>Original SPR</Button></div><small>Animal Island UI by guokaigdg · CC BY-NC 4.0. Liquid DOM by Andrew Prifer · MIT.</small></section>
  return <div className={island ? 'island-ui' : 'spr-ui'}><PiApp OverviewComponent={island ? IslandOverview : undefined} appearance={appearance} branding={island ? <img className="island-brand-leaf" src={leafArt} alt=""/> : null} /></div>
}
