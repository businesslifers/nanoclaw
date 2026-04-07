#!/bin/bash
# Clean up container logs older than 7 days
find /home/adam/derek/groups/*/logs -name "container-*.log" -mtime +7 -delete 2>/dev/null
