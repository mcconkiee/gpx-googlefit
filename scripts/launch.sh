forever start app.js

echo "logs are at: "
forever logs 
var1=$(forever logs | grep app.js)
var2=${var1:40}
echo "copied $var2 to pasteboard"
echo "tail -f $var2"
