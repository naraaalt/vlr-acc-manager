// QA runner (Node): throttled-network loader visibility test for the
// skin showcase modal. See plan 2026-09-08_210607.
import subprocess from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import time from 'node:timers/promises';
