"""Bounded application resource use. This is not upstream DDoS protection."""
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import threading
import time

class TokenBucket:
    def __init__(self,rate,burst):
        self.rate,self.burst,self.tokens,self.updated=rate,burst,burst,time.monotonic()
    def take(self,cost,now):
        self.tokens=min(self.burst,self.tokens+max(0,now-self.updated)*self.rate)
        self.updated=now
        if cost>self.tokens:return False
        self.tokens-=cost
        return True

class PublicLimits:
    def __init__(self):
        self.lock=threading.Lock();self.clients=OrderedDict()
        self.global_requests=TokenBucket(60,180)
        self.global_bytes=TokenBucket(2_000_000,8_000_000)
    def allow(self,client,cost=1,bandwidth=False):
        with self.lock:
            now=time.monotonic()
            if client not in self.clients:
                if len(self.clients)>=4096:self.clients.popitem(last=False)
                self.clients[client]=(TokenBucket(3,60),TokenBucket(512_000,4_000_000))
            self.clients.move_to_end(client)
            local=self.clients[client][1 if bandwidth else 0]
            global_bucket=self.global_bytes if bandwidth else self.global_requests
            # Reject before charging either budget if either is exhausted.
            for bucket in (local,global_bucket):
                bucket.tokens=min(bucket.burst,bucket.tokens+max(0,now-bucket.updated)*bucket.rate);bucket.updated=now
            if min(local.tokens,global_bucket.tokens)<cost:return False
            local.tokens-=cost;global_bucket.tokens-=cost
            return True

class QuietHandler(BaseHTTPRequestHandler):
    def version_string(self):return ''
    def send_header(self,keyword,value):
        if keyword.lower() not in ('server','x-powered-by'):super().send_header(keyword,value)

class BoundedHTTPServer(ThreadingHTTPServer):
    daemon_threads=True
    request_queue_size=16
    def __init__(self,*args,max_workers=16,**kwargs):
        self.slots=threading.BoundedSemaphore(max_workers)
        super().__init__(*args,**kwargs)
    def process_request(self,request,client_address):
        if not self.slots.acquire(False):
            try:
                request.settimeout(1)
                request.sendall(b'HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nRetry-After: 5\r\nConnection: close\r\n\r\n')
            except OSError:pass
            finally:self.shutdown_request(request)
            return
        try:super().process_request(request,client_address)
        except BaseException:self.slots.release();raise
    def process_request_thread(self,request,client_address):
        try:super().process_request_thread(request,client_address)
        finally:self.slots.release()

def public_client(handler):
    peer=ipaddress.ip_address(handler.client_address[0])
    # Only the local reverse proxy may supply this header. Caddy overwrites it.
    if peer.is_loopback:
        try:return str(ipaddress.ip_address(handler.headers.get('X-Pi-Client-IP','')))
        except ValueError:pass
    return str(peer)
