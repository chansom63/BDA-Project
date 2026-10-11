#!/usr/bin/env perl
# Hadoop Streaming MapReduce Mapper
# Extracts airline, altitude, speed, and engine temperature from telemetry JSON.

use strict;
use warnings;

while (my $line = <STDIN>) {
    chomp $line;
    next if $line =~ /^\s*$/;
    my $airline = ($line =~ /"airline"\s*:\s*"([^"]+)"/) ? $1 : "Unknown Airline";
    my $alt = ($line =~ /"altitudeFt"\s*:\s*([0-9.]+)/) ? $1 : 0;
    my $spd = ($line =~ /"speedKnots"\s*:\s*([0-9.]+)/) ? $1 : 0;
    my $tmp = ($line =~ /"engineTemperature"\s*:\s*([0-9.]+)/) ? $1 : 700;
    print "$airline\t$alt,$spd,$tmp\n";
}
