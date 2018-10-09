
SELECT 
	EpicID,
	CASE   
      WHEN GETDATE() < StartDateBaseline THEN 0   
	  else DATEDIFF(day, StartDateBaseline, GETDATE()) / CAST(DATEDIFF(day, StartDateBaseline, EndDateBaseline) + 1 as FLOAT)
    END PPlan
FROM [dbo].Epics

SELECT 
	StoryID,
	CASE   
      WHEN GETDATE() < StartDateBaseline THEN 0   
	  else DATEDIFF(day, StartDateBaseline, GETDATE()) / CAST(DATEDIFF(day, StartDateBaseline, EndDateBaseline) + 1 as FLOAT)
    END PPlan
FROM [dbo].[Stories]

SELECT 
	SubtaskID,
	CASE   
      WHEN GETDATE() < StartDateBaseline THEN 0   
	  else DATEDIFF(day, StartDateBaseline, GETDATE()) / CAST(DATEDIFF(day, StartDateBaseline, EndDateBaseline) + 1 as FLOAT)
    END PPlan
FROM [dbo].Subtasks

