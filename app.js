var request = require('request');
var sql = require('mssql');
var async = require('async');
var configs = require('./configs.js');
		
async.auto({
	importProjects: function(cb) {
		request({ url: configs.jira.baseUrl + 'project', headers: configs.jira.headers }, function(error, response, body){
			if(error || response.statusCode !== 200) return cb('API Error');
			cb(null, JSON.parse(body));
		});
	},
	importIssues: function(cb) {
		var issues = [];
		getIssues(0);
		function getIssues(startAt) {
			var url = configs.jira.baseUrl + 'search?maxResults=' + configs.jira.maxResults + '&startAt=' + startAt;
			request({ url: url, headers: configs.jira.headers }, function(error, response, body){
				if(error || response.statusCode !== 200) return cb('API Error');
			
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
		.query('DELETE FROM Indicators; DELETE FROM Subtasks; DELETE FROM Stories; DELETE FROM Epics; DELETE FROM Projects', cb);
	}],
	saveProjects: ['importProjects', 'purge', function(results, cb) {
		async.eachSeries(results.importProjects, function(project, cb){
			new sql.Request()
			.input('ProjectID', sql.VarChar(50), project.id)
			.input('ProjectKey', sql.VarChar(50), project.key)
			.input('Name', sql.VarChar(50), project.name)
			.query('INSERT INTO Projects VALUES (@ProjectID, @ProjectKey, @Name)', cb);
		}, cb);
	}],
	saveEpics: ['importIssues', 'saveProjects', function(results, cb) {
		async.eachSeries(filterByIssueType(results.importIssues, 'Epic'), function(epic, cb){
			new sql.Request()
			.input('EpicID', sql.VarChar(50), epic.id)
			.input('EpicKey', sql.VarChar(50), epic.key)
			.input('ProjectKey', sql.VarChar(50), epic.fields.project.key)
			.input('IssueType', sql.VarChar(50), epic.fields.issuetype.name)
			.input('Summary', sql.VarChar(50), epic.fields.summary)
			.input('Status', sql.VarChar(50), epic.fields.status.name)
			.input('Assignee', sql.VarChar(50), epic.fields.assignee ? epic.fields.assignee.displayName : '')
			.input('DueDate', sql.Date, epic.fields.duedate)
			.input('StartDateBaseline', sql.Date, epic.fields.customfield_10028)
			.input('EndDateBaseline', sql.Date, epic.fields.customfield_10029)
			.query('INSERT INTO Epics VALUES (@EpicID, @EpicKey, @ProjectKey, @IssueType, @Summary, @Status, @Assignee, @DueDate, @StartDateBaseline, @EndDateBaseline)', cb);
		}, cb);
	}],
	saveStories: ['saveEpics', function(results, cb) {
		async.eachSeries(filterByIssueType(results.importIssues, 'Story'), function(story, cb){
			new sql.Request()
			.input('StoryID', sql.VarChar(50), story.id)
			.input('StoryKey', sql.VarChar(50), story.key)
			.input('EpicKey', sql.VarChar(50), story.fields.customfield_10013)
			.input('IssueType', sql.VarChar(50), story.fields.issuetype.name)
			.input('Summary', sql.VarChar(50), story.fields.summary)
			.input('Status', sql.VarChar(50), story.fields.status.name)
			.input('Assignee', sql.VarChar(50), story.fields.assignee ? story.fields.assignee.displayName : '')
			.input('DueDate', sql.Date, story.fields.duedate)
			.input('StartDateBaseline', sql.Date, story.fields.customfield_10028)
			.input('EndDateBaseline', sql.Date, story.fields.customfield_10029)
			.query('INSERT INTO Stories VALUES (@StoryID, @StoryKey, @EpicKey, @IssueType, @Summary, @Status, @Assignee, @DueDate, @StartDateBaseline, @EndDateBaseline)', cb);
		}, cb);
	}],
	saveSubtasks: ['saveStories', function(results, cb) {
		async.eachSeries(filterByIssueType(results.importIssues, 'Sub-task'), function(subtask, cb){
			new sql.Request()
			.input('SubtaskID', sql.VarChar(50), subtask.id)
			.input('SubtaskKey', sql.VarChar(50), subtask.key)
			.input('StoryID', sql.VarChar(50), subtask.fields.parent.id)
			.input('IssueType', sql.VarChar(50), subtask.fields.issuetype.name)
			.input('Summary', sql.VarChar(50), subtask.fields.summary)
			.input('Status', sql.VarChar(50), subtask.fields.status.name)
			.input('Assignee', sql.VarChar(50), subtask.fields.assignee ? subtask.fields.assignee.displayName : '')
			.input('DueDate', sql.Date, subtask.fields.duedate)
			.input('StartDateBaseline', sql.Date, subtask.fields.customfield_10028)
			.input('EndDateBaseline', sql.Date, subtask.fields.customfield_10029)
			.query('INSERT INTO Subtasks VALUES (@SubtaskID, @SubtaskKey, @StoryID, @IssueType, @Summary, @Status, @Assignee, @DueDate, @StartDateBaseline, @EndDateBaseline)', function(err){
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