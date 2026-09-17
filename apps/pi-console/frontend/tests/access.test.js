import React from 'react'
import {render,screen} from '@testing-library/react'
import AppGate from '../src/pi/AppGate'
jest.mock('../src/pi/MetrApp',()=>()=> <div>Private configuration</div>)
jest.mock('../src/pi/PublicHome',()=>()=> <div>Public metrics</div>)
afterEach(()=>jest.restoreAllMocks())
test.each(['public',undefined,'forged'])('untrusted mode %s never renders private configuration',async mode=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({access_mode:mode})})
 render(<AppGate/>);expect(screen.queryByText('Private configuration')).toBeNull()
 expect(await screen.findByText('Public metrics')).toBeInTheDocument()
 expect(screen.queryByText('Private configuration')).toBeNull()
})
test('only private listener session enables administrative interface',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({access_mode:'tailnet'})})
 render(<AppGate/>);expect(await screen.findByText('Private configuration')).toBeInTheDocument()
})
test('failed access check keeps configuration hidden',async()=>{
 global.fetch=jest.fn().mockRejectedValue(Error('offline'))
 render(<AppGate/>);expect(await screen.findByText('Connection unavailable')).toBeInTheDocument()
 expect(screen.queryByText('Private configuration')).toBeNull()
})
