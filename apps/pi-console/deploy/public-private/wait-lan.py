#!/usr/bin/python3
import socket,time
for attempt in range(120):
 try:
  with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as probe:probe.bind(('192.168.0.56',0))
  break
 except OSError:time.sleep(1)
else:raise SystemExit('Expected LAN address not ready after 120 seconds')
