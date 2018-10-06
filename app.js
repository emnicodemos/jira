var request = require('request');
var sql = require('mssql');
var async = require('async');
var configs = require('./configs.js');
		
async.auto({
	importFromJira: function(cb) {
		var issues = [];
		getIssues(0);
		function getIssues(startAt) {
			var url = configs.jira.baseUrl + startAt;
			request({ url: url, headers: configs.jira.headers }, function(error, response, body){
				if(error || response.statusCode !== 200) return console.error('API Error');
			
				var result = JSON.parse(body);
				result.issues.forEach(function(issue){
					issues.push(issue);
				});
				
				if(issues.length == result.total)
					cb(null, issues);
				else
					getIssues(startAt + configs.jira.maxResults);
			});
		}
	},
	sqlConnect: function(cb) {
		sql.connect(configs.azure, cb);
	},
	purge: ['sqlConnect', function(results, cb) {
		new sql.Request()
		.query('DELETE FROM Subtasks; DELETE FROM Stories; DELETE FROM Epics', cb);
	}],
	saveEpics: ['importFromJira', 'purge', function(results, cb) {
		async.eachSeries(filterByIssueType(results.importFromJira, 'Epic'), function(epic, cb){
			new sql.Request()
			.input('epicID', sql.VarChar(50), epic.id)
			.input('epicKey', sql.VarChar(50), epic.key)
			.input('projectKey', sql.VarChar(50), epic.fields.project.key)
			.input('issueType', sql.VarChar(50), epic.fields.issuetype.name)
			.input('summary', sql.VarChar(50), epic.fields.summary)
			.input('status', sql.VarChar(50), epic.fields.status.name)
			.input('assignee', sql.VarChar(50), epic.fields.assignee ? epic.fields.assignee.displayName : '')
			.input('duedate', sql.Date, epic.fields.duedate)
			.query('INSERT INTO Epics VALUES (@epicID, @epicKey, @projectKey, @issueType, @summary, @status, @assignee, @duedate)', cb);
		}, cb);
	}],
	saveStories: ['saveEpics', function(results, cb) {
		async.eachSeries(filterByIssueType(results.importFromJira, 'Story'), function(story, cb){
			new sql.Request()
			.input('storyID', sql.VarChar(50), story.id)
			.input('storyKey', sql.VarChar(50), story.key)
			.input('epicKey', sql.VarChar(50), story.fields.customfield_10013)
			.input('issueType', sql.VarChar(50), story.fields.issuetype.name)
			.input('summary', sql.VarChar(50), story.fields.summary)
			.input('status', sql.VarChar(50), story.fields.status.name)
			.input('assignee', sql.VarChar(50), story.fields.assignee ? story.fields.assignee.displayName : '')
			.query('INSERT INTO Stories VALUES (@storyID, @storyKey, @epicKey, @issueType, @summary, @status, @assignee)', cb);
		}, cb);
	}],
	saveSubtasks: ['saveStories', function(results, cb) {
		async.eachSeries(filterByIssueType(results.importFromJira, 'Sub-task'), function(subtask, cb){
			new sql.Request()
			.input('subtaskID', sql.VarChar(50), subtask.id)
			.input('subtaskKey', sql.VarChar(50), subtask.key)
			.input('storyID', sql.VarChar(50), subtask.fields.parent.id)
			.input('issueType', sql.VarChar(50), subtask.fields.issuetype.name)
			.input('summary', sql.VarChar(50), subtask.fields.summary)
			.input('status', sql.VarChar(50), subtask.fields.status.name)
			.input('assignee', sql.VarChar(50), subtask.fields.assignee ? subtask.fields.assignee.displayName : '')
			.query('INSERT INTO Subtasks VALUES (@subtaskID, @subtaskKey, @storyID, @issueType, @summary, @status, @assignee)', function(err){
				if (err) console.log(subtask.fields.parent.id);
				cb();
			});
		}, cb);
	}]
}, function(err, results) {
	if (err) console.error(err);
	console.log('Finished');
});

function filterByIssueType (issues, issueType) {
	return issues.filter(function(issue){
		return issue.fields.issuetype.name === issueType;
	});
};