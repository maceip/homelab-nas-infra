import React from 'react'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import ReceiptToast from '../src/pi/ReceiptToast'
const receipt='1234567890abcdef1234567890abcdef'
beforeEach(()=>{sessionStorage.clear();window.history.replaceState(null,'','/');Object.defineProperty(navigator,'clipboard',{value:{writeText:jest.fn().mockResolvedValue()},configurable:true})})
test('return home consumes the receipt and copy writes the exact opaque identifier',async()=>{
 sessionStorage.setItem('pi-upload-receipt',JSON.stringify({receipt,name:'holiday.jpg',at:Date.now()}));
 window.history.replaceState(null,'','/#upload-receipt='+receipt);
 const {unmount}=render(<ReceiptToast/>);
 expect(await screen.findByText('holiday.jpg')).toBeInTheDocument();expect(window.location.hash).toBe('');
 fireEvent.click(screen.getByRole('button',{name:'Copy receipt'}));
 await waitFor(()=>expect(navigator.clipboard.writeText).toHaveBeenCalledWith(receipt));
 expect(await screen.findByText('Copied to clipboard.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Dismiss upload receipt'}));expect(screen.queryByText('File delivered.')).toBeNull();
 unmount();render(<ReceiptToast/>);expect(screen.queryByText('File delivered.')).toBeNull();
});
test('hash fallback works when storage was unavailable and clipboard failure offers manual copy',async()=>{
 window.history.replaceState(null,'','/#upload-receipt='+receipt);navigator.clipboard.writeText.mockRejectedValue(Error('denied'));
 render(<ReceiptToast/>);expect(await screen.findByText(receipt)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Copy receipt'}));expect(await screen.findByText(/copy it manually/)).toBeInTheDocument();
});
test.each([{receipt:'<script>bad</script>'},{receipt,at:Date.now()-7200000}])('invalid or expired receipts never render a success toast',value=>{
 sessionStorage.setItem('pi-upload-receipt',JSON.stringify(value));render(<ReceiptToast/>);expect(screen.queryByText('File delivered.')).toBeNull();
});
