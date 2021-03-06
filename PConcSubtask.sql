SELECT 
	TotalTable.StoryID, 
	CASE   
      WHEN DoneTable.Done is null THEN 0   
	  else DoneTable.Done / CAST(TotalTable.Total AS FLOAT)
    END PConc
FROM 

  (SELECT story.StoryID, count(*) Done
   FROM [dbo].[Stories] story inner join [dbo].[Subtasks] subtask on story.StoryID = subtask.StoryID
   where subtask.Status = 'Done'
   group by story.StoryID) DoneTable

   RIGHT JOIN

  (SELECT story.StoryID, count(*) Total
   FROM [dbo].[Stories] story inner join [dbo].[Subtasks] subtask on story.StoryID = subtask.StoryID
   where subtask.Status <> 'Cancelled'
   group by story.StoryID) TotalTable

   ON DoneTable.StoryID = TotalTable.StoryID