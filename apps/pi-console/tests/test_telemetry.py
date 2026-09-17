import asyncio
import json
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
import telemetry as t

class TelemetryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.old=t.STATE;t.STATE=Path(self.tmp.name)
    def tearDown(self):
        t.STATE=self.old;self.tmp.cleanup()
    def entry(self, text, index, unit='ssh.service', ts=None):
        return {'MESSAGE':text,'__CURSOR':str(index),'__REALTIME_TIMESTAMP':str(int((ts or time.time())*1e6)),'_SYSTEMD_UNIT':unit}
    def test_expanding_watch_scope_is_not_a_configuration_change(self):
        with t.db() as c:
            t.track_configuration(c,{'/old':'aaa'},version=1)
            t.track_configuration(c,{'/old':'aaa','/new':'bbb'},version=2)
            self.assertEqual(c.execute('select count(*) from events').fetchone()[0],0)
            t.track_configuration(c,{'/old':'changed','/new':'bbb'},version=2)
            self.assertEqual(c.execute('select kind from events').fetchone()[0],'configuration_change')

    def test_isolated_rejected_probe_is_not_an_alert(self):
        with t.db() as c:t.classify(c,self.entry('http request path=/.env remote=198.51.100.4:443 status=404',1,'upstream-headscale.service'))
        self.assertEqual(t.snapshot()['events'],[])
    def test_burst_is_deduplicated_and_secret_never_stored(self):
        with t.db() as c:
            for i in range(8):t.classify(c,self.entry('Failed password for invalid user secret-password from 198.51.100.4 port 44',i))
        s=t.snapshot();self.assertEqual(len(s['events']),1)
        self.assertEqual(s['events'][0]['kind'],'auth_failure_burst')
        self.assertNotIn('secret-password',json.dumps(s))
    def test_success_new_source_is_flagged_known_admin_is_not(self):
        with t.db() as c:
            t.classify(c,self.entry('Accepted password for pi from 192.168.0.142 port 3',1))
            t.classify(c,self.entry('Accepted password for pi from 198.51.100.4 port 3',2))
        self.assertEqual([e['kind'] for e in t.snapshot()['events']],['unfamiliar_login'])
    def test_journal_replay_does_not_inflate_counts(self):
        e=self.entry('Failed password for pi from 198.51.100.4 port 3',1)
        with t.db() as c:
            for _ in range(20):t.classify(c,e)
        self.assertEqual(t.snapshot()['counts']['auth_failure'],1)
        self.assertEqual(t.snapshot()['events'],[])
    def test_missing_data_not_healthy_zero(self):
        self.assertFalse(t.snapshot()['available'])
    def test_smtp_denies_other_sources_and_relay(self):
        h=t.RouterMail();env=SimpleNamespace(mail_options=[],rcpt_tos=[])
        self.assertTrue(asyncio.run(h.handle_MAIL(None,SimpleNamespace(peer=('192.168.0.142',123)),env,'archer@router.local',[])).startswith('550'))
        self.assertTrue(asyncio.run(h.handle_RCPT(None,None,env,'someone@example.com',[])).startswith('550'))
    def test_router_archival_and_repeat_export_dedup(self):
        h=t.RouterMail();env=SimpleNamespace(mail_options=[],rcpt_tos=[],original_content=b'Subject: Router log\r\nContent-Type: text/plain\r\n\r\n'+b'login failed\r\n'*6)
        session=SimpleNamespace(peer=('192.168.0.1',234))
        self.assertTrue(asyncio.run(h.handle_MAIL(None,session,env,'archer@router.local',[])).startswith('250'))
        asyncio.run(h.handle_RCPT(None,session,env,'router-logs@pi.local',[]))
        for _ in range(2):self.assertTrue(asyncio.run(h.handle_DATA(None,session,env)).startswith('250'))
        self.assertEqual(len(list((t.STATE/'router').glob('*.gz'))),2)
        self.assertEqual(len(t.snapshot()['events']),1)
    def test_graph_not_truncated_with_detail_list(self):
        with t.db() as c:
            for i in range(120):t.event(c,time.time(),'fixture','configuration_change','notice','Change',str(i))
        s=t.snapshot();self.assertEqual(len(s['events']),100)
        self.assertEqual(sum(b['count'] for b in s['activity_bins']),120)

if __name__=='__main__':unittest.main()

class RouterArchiveTest(unittest.TestCase):
    def test_real_router_tar_attachment_is_read_without_extracting_paths(self):
        import io,tarfile,gzip
        from email.message import EmailMessage
        buf=io.BytesIO()
        with tarfile.open(fileobj=buf,mode='w') as archive:
            content=b'2026-09-13 Firmware update failed\n'
            member=tarfile.TarInfo('../../syslog.txt');member.size=len(content)
            archive.addfile(member,io.BytesIO(content))
        mail=EmailMessage();mail.set_content('The system log is attached.')
        mail.add_attachment(gzip.compress(buf.getvalue()),maintype='text',subtype='plain',filename='syslog.tar.gz')
        self.assertIn('Firmware update failed',t.router_text(mail.as_bytes()))

    def test_oversized_compressed_attachment_is_rejected(self):
        import gzip
        from email.message import EmailMessage
        mail=EmailMessage();mail.set_content('Log')
        mail.add_attachment(gzip.compress(b'a'*(5*1024*1024)),maintype='text',subtype='plain',filename='syslog.tar.gz')
        with self.assertRaises(ValueError):t.router_text(mail.as_bytes())

class InstrumentTelemetryTests(unittest.TestCase):
    def counters(self, seconds=10, boot='boot-a', interface='eth1', rx=1000, tx=500, disks=None):
        return {'time': seconds, 'boot': boot, 'disks': {'sda':100,'sdb':200} if disks is None else disks,
                'network': {'interface':interface,'rx':rx,'tx':tx}}

    def test_rates_use_busiest_member_and_bits_per_second(self):
        before=self.counters()
        after=self.counters(seconds=40,rx=3751000,tx=7500500,disks={'sda':15100,'sdb':6200})
        rates=t.io_rates(before,after)
        self.assertEqual(rates,{'disk_busy':50,'net_rx_bps':1000000,'net_tx_bps':2000000})

    def test_first_sample_reboot_and_long_gap_are_unknown(self):
        for before,after in [(None,self.counters()),(self.counters(),self.counters(40,boot='boot-b')),
                             (self.counters(),self.counters(400)),(self.counters(),self.counters(9))]:
            self.assertTrue(all(v is None for v in t.io_rates(before,after).values()))

    def test_interface_change_counter_reset_and_missing_member_are_not_zero(self):
        before=self.counters()
        self.assertIsNone(t.io_rates(before,self.counters(40,interface='wlan0'))['net_rx_bps'])
        self.assertIsNone(t.io_rates(before,self.counters(40,rx=1))['net_rx_bps'])
        self.assertIsNone(t.io_rates(before,self.counters(40,disks={'sda':200}))['disk_busy'])
        self.assertIsNone(t.io_rates(before,self.counters(40,disks={'sda':0,'sdb':300}))['disk_busy'])

    def test_additive_migration_keeps_old_history_and_null_new_fields(self):
        import sqlite3
        with tempfile.TemporaryDirectory() as directory, patch.object(t,'STATE',Path(directory)):
            c=sqlite3.connect(Path(directory)/'telemetry.sqlite')
            c.execute('CREATE TABLE samples(ts REAL PRIMARY KEY,cpu REAL,temp REAL,load REAL)')
            c.execute('INSERT INTO samples VALUES(?,?,?,?)',(time.time(),5,50,.1));c.commit();c.close()
            with t.db() as c:
                row=c.execute('SELECT cpu,memory_percent,net_rx_bps FROM samples').fetchone()
                self.assertEqual(row,(5,None,None))
            with t.db() as c:self.assertEqual(c.execute('SELECT count(*) FROM samples').fetchone()[0],1)

    def test_counter_sources_exclude_overlay_and_raid_double_counting(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            values={'proc/sys/kernel/random/boot_id':'test',
                    'proc/net/route':'Iface Destination Gateway Flags RefCnt Use Metric\neth1 00000000 01000000 0003 0 0 50\ntailscale0 00000000 01000000 0003 0 0 100',
                    'sys/class/net/eth1/statistics/rx_bytes':'1000','sys/class/net/eth1/statistics/tx_bytes':'2000',
                    'sys/class/block/sda/stat':'1 2 3 4 5 6 7 8 9 500 11'}
            for name,value in values.items():
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(value)
            (root/'sys/block/md0/slaves/sda').mkdir(parents=True)
            result=t.read_io_counters(root)
            self.assertEqual(result['disks'],{'sda':500})
            self.assertEqual(result['network'],{'interface':'eth1','rx':1000,'tx':2000})
