
#How
Use `batch.sh` to find all `tcx` files and convert to `gpx`. The script does not alter the original...simply creates a new file in `gpx` format.

```
$ ./src/batch.sh 
Enter the path to the file: /Users/you/path/to/file/
convert /Users/you/path/to/file//2015-01-02-16-52-59.tcx to /Users/you/path/to/file/2015-01-02-16-52-59.gpx
convert /Users/you/path/to/file//2015-01-04-17-31-17.tcx to /Users/you/path/to/file/2015-01-04-17-31-17.gpx
convert /Users/you/path/to/file//2015-01-07-16-58-50.tcx to /Users/you/path/to/file/2015-01-07-16-58-50.gpx
convert /Users/you/path/to/file//2015-01-08-16-42-51.tcx to /Users/you/path/to/file/2015-01-08-16-42-51.gpx
convert /Users/you/path/to/file//2015-01-10-16-59-43.tcx to /Users/you/path/to/file/2015-01-10-16-59-43.gpx
...
```

Note the trailing `/` in the path entered at the prompt

#Why
I have a ton of garmin files, but prefered somethign more generic since many other services also utilize `gpx`