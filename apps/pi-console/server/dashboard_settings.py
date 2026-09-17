import ipaddress,json
from pathlib import Path
PATH=Path('/var/lib/pi-console/settings.json')
DEFAULT={'ssh_burst_threshold':5,'web_probe_threshold':10,'trusted_admin_ips':['127.0.0.1','::1','192.168.0.142','192.168.100.1']}
def read():
 try:return {**DEFAULT,**json.loads(PATH.read_text())}
 except (OSError,ValueError):return DEFAULT.copy()
def write(value):
 if not isinstance(value,dict) or set(value)!=set(DEFAULT):raise ValueError('Unknown settings.')
 for key,low,high in [('ssh_burst_threshold',5,50),('web_probe_threshold',10,100)]:
  if type(value[key]) is not int or not low<=value[key]<=high:raise ValueError('Threshold is outside the supported range.')
 ips=value['trusted_admin_ips']
 if not isinstance(ips,list) or len(ips)>32 or any(not isinstance(x,str) for x in ips):raise ValueError('Use up to 32 administrator IP addresses.')
 value['trusted_admin_ips']=[str(ipaddress.ip_address(x)) for x in ips]
 PATH.parent.mkdir(mode=0o750,parents=True,exist_ok=True)
 p=PATH.with_suffix('.pending');p.write_text(json.dumps(value));p.chmod(0o640);p.replace(PATH)
 return read()
