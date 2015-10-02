#!/bin/bash
read -e -p "Enter the path to the file: " FILEPATH
eval FILEPATH=$FILEPATH
dir=`dirname $0`
echo $PWD
ct=1
for file in $FILEPATH*.tcx
do

basename=$(basename $file)
filename=${basename%.*}
echo "convert $file to $FILEPATH$filename.gpx"
$dir/gpsbabel -i gtrnctr -f $file -o gpx -F $FILEPATH$filename.gpx
((ct=ct+1))
done

