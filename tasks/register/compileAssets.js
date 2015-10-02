module.exports = function (grunt) {
	grunt.registerTask('compileAssets', [
		'clean:dev',	
		'bower:dev',	
		'jst:dev',
		'less:dev',
		'copy:dev',
		'coffee:dev'
	]);
};
