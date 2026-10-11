#!/usr/bin/env perl
# Hadoop Streaming MapReduce Reducer
# Aggregates telemetry records per airline (record count, avg altitude, max speed, avg temp, max temp).

use strict;
use warnings;

my ($cur_airline, $count, $total_alt, $max_spd, $total_tmp, $max_tmp) = ("", 0, 0, 0, 0, 0);

print "Airline\tTotalEvents\tAvgAltitudeFt\tMaxSpeedKnots\tAvgEngineTempC\tMaxEngineTempC\n";

while (my $line = <STDIN>) {
    chomp $line;
    next if $line =~ /^\s*$/;
    my ($airline, $metrics) = split(/\t/, $line, 2);
    next unless defined $metrics;
    my ($alt, $spd, $tmp) = split(/,/, $metrics);
    $alt //= 0; $spd //= 0; $tmp //= 0;

    if ($cur_airline eq $airline) {
        $count++;
        $total_alt += $alt;
        $max_spd = $spd if $spd > $max_spd;
        $total_tmp += $tmp;
        $max_tmp = $tmp if $tmp > $max_tmp;
    } else {
        if ($cur_airline ne "" && $count > 0) {
            my $avg_alt = sprintf("%.1f", $total_alt / $count);
            my $avg_tmp = sprintf("%.1f", $total_tmp / $count);
            print "$cur_airline\t$count\t$avg_alt\t$max_spd\t$avg_tmp\t$max_tmp\n";
        }
        $cur_airline = $airline;
        $count = 1;
        $total_alt = $alt;
        $max_spd = $spd;
        $total_tmp = $tmp;
        $max_tmp = $tmp;
    }
}

if ($cur_airline ne "" && $count > 0) {
    my $avg_alt = sprintf("%.1f", $total_alt / $count);
    my $avg_tmp = sprintf("%.1f", $total_tmp / $count);
    print "$cur_airline\t$count\t$avg_alt\t$max_spd\t$avg_tmp\t$max_tmp\n";
}
