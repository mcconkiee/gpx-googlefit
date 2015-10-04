#!/bin/bash
read -e -p "Enter the path to the file: " FILEPATH
eval FILEPATH=$FILEPATH
dir=`dirname $0`
echo $PWD
ct=1
for file in $FILEPATH*.fit
do

basename=$(basename $file)
filename=${basename%.*}
echo "convert $file to $FILEPATH$filename.fit"
$dir/gpsbabel -i garmin_fit -f $file -o gpx -F $FILEPATH$filename.gpx
((ct=ct+1))
done

