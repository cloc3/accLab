Field	Type	Null	Key	Default	Extra
id	int(11)	NO	PRI	NULL	auto_increment
session_id	varchar(64)	NO	UNI	NULL	
dt1	int(11)	YES		NULL	
dt_gap	int(11)	YES		NULL	
dt2	int(11)	YES		NULL	
dt_tot	int(11)	YES		NULL	
spazio_ds	float	YES		NULL	
v1	float	YES		NULL	
v_gap	float	YES		NULL	
v2	float	YES		NULL	
v_media	float	YES		NULL	
a12	float	YES		NULL	
a23	float	YES		NULL	
a13	float	YES		NULL	
a_min_quad	float	YES		NULL	
timestamp	timestamp	NO		current_timestamp()	on update current_timestamp()
esclusa	tinyint(1)	NO		0	
note	text	YES		NULL	
dati_evento	longtext	YES		NULL	
firmaSSE	varchar(5)	YES		NULL	
