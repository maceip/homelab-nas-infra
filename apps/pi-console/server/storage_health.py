#!/usr/bin/env python3
"""Read actual NAS directory/capacity; never repair, mount, or write user data."""
import json
import os
from pathlib import Path
import shutil
import time


def probe(mount='/srv/storage', mountinfo='/proc/self/mountinfo', expected_uuid=None):
    result = {'healthy': False, 'mount': mount, 'sampled_at': time.time(),
              'downloads_paused': Path('/var/lib/homelab-storage-diagnostics').exists()}
    try:
        lines=Path(mountinfo).read_text().splitlines()
        mounted = any(line.split()[4] == mount and ' - xfs ' in line for line in lines)
        expected_uuid=expected_uuid or os.environ.get('PI_NAS_UUID')
        if expected_uuid and mounted:
            expected=Path('/dev/disk/by-uuid')/expected_uuid
            source=next(line.split(' - ',1)[1].split()[1] for line in lines if line.split()[4]==mount and ' - xfs ' in line)
            if not expected.exists() or expected.resolve()!=Path(source).resolve():
                raise OSError('The mounted NAS does not match the expected filesystem.')
            result['identity_verified']=True
        if not mounted:
            raise OSError('The NAS filesystem is not mounted.')
        with os.scandir(mount + '/public') as entries:
            next(entries, None)
        capacity = shutil.disk_usage(mount)
        result.update(healthy=True, total=capacity.total, free=capacity.free,
                      used=capacity.used, message='Storage is readable.')
    except OSError as exc:
        result['message'] = str(exc)
    return result


if __name__ == '__main__':
    print(json.dumps(probe()))
