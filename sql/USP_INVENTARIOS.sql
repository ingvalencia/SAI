CREATE PROCEDURE [dbo].[USP_INVENTARIOS]
  @alma NVARCHAR(20),
  @fecinv DATE,
  @usuario NVARCHAR(20),
  @cia nvarchar(30)
AS
BEGIN
  if @cia ='RECREFAM'
     BEGIN
		SELECT  T1.[U_FAMILIA] AS cod_fam,
				t2.descr AS nom_fam,
				T1.[U_SUBFAMILIA] AS cod_subfam,
				t3.descr AS nom_subfam,
				T0.[ItemCode] AS ItemCode,
				T1.[ItemName] AS ItemName,
				T0.[WhsCode] AS almacen,
				0 AS cant_invfis,
				GETDATE() AS fecha_carga,
				@fecinv AS fecha_inv,
				@usuario AS usuario,
				0 AS estatus,
				T1.CodeBars,
				@cia
		  FROM [RECREFAM].[dbo].OITW T0
		  INNER JOIN [RECREFAM].[dbo].OITM T1 ON T0.[ItemCode] = T1.[ItemCode]
		  LEFT JOIN [RECREFAM].[dbo].ufd1 t2 ON t2.tableid = 'oitm' AND t2.fieldid = 0 AND t2.fldvalue = T1.[U_FAMILIA]
		  LEFT JOIN [RECREFAM].[dbo].ufd1 t3 ON t3.tableid = 'oitm' AND t3.fieldid = 1 AND t3.fldvalue = T1.[U_SUBFAMILIA]
		  WHERE T0.[WhsCode] = @alma 
			AND T1.[frozenFor] = 'n'
			----AND t2.descr = 'INSUMOS'
		  ORDER BY T1.[U_FAMILIA], T1.[U_SUBFAMILIA];
	 END

  if @cia ='VESER'
     BEGIN
		SELECT  T1.[U_FAMILIA] AS cod_fam,
				t2.descr AS nom_fam,
				T1.[U_SUBFAMILIA] AS cod_subfam,
				T1.[U_SUBFAMILIA] AS nom_subfam,
				T0.[ItemCode] AS ItemCode,
				T1.[ItemName] AS ItemName,
				T0.[WhsCode] AS almacen,
				0 AS cant_invfis,
				GETDATE() AS fecha_carga,
				@fecinv AS fecha_inv,
				@usuario AS usuario,
				0 AS estatus,
				T1.CodeBars,
				@cia
		  FROM [VESER].[dbo].OITW T0
		  INNER JOIN [VESER].[dbo].OITM T1 ON T0.[ItemCode] = T1.[ItemCode]
		  LEFT JOIN [VESER].[dbo].ufd1 t2 ON t2.tableid = 'oitm' AND t2.fieldid = 12 AND t2.fldvalue = T1.[U_FAMILIA]
		  LEFT JOIN [VESER].[dbo].ufd1 t3 ON t3.tableid = 'oitm' AND t3.fieldid = 1 AND t3.fldvalue = T1.[U_SUBFAMILIA]
		  WHERE T0.[WhsCode] = @alma 
			AND T1.[frozenFor] = 'n'
			---AND t2.descr = 'INSUMOS'
		  ORDER BY T1.[U_FAMILIA], T1.[U_SUBFAMILIA];
	 END

  if @cia ='OPARDIV'
     BEGIN
		SELECT  T1.[U_FAMILIA] AS cod_fam,
				t2.descr AS nom_fam,
				T1.[U_SUBFAMILIA] AS cod_subfam,
				t3.descr AS nom_subfam,
				T0.[ItemCode] AS ItemCode,
				T1.[ItemName] AS ItemName,
				T0.[WhsCode] AS almacen,
				0 AS cant_invfis,
				GETDATE() AS fecha_carga,
				@fecinv AS fecha_inv,
				@usuario AS usuario,
				0 AS estatus,
				T1.CodeBars,
				@cia
		  FROM [OPARDIV].[dbo].OITW T0
		  INNER JOIN [OPARDIV].[dbo].OITM T1 ON T0.[ItemCode] = T1.[ItemCode]
		  LEFT JOIN [OPARDIV].[dbo].ufd1 t2 ON t2.tableid = 'oitm' AND t2.fieldid = 0 AND t2.fldvalue = T1.[U_FAMILIA]
		  LEFT JOIN [OPARDIV].[dbo].ufd1 t3 ON t3.tableid = 'oitm' AND t3.fieldid = 1 AND t3.fldvalue = T1.[U_SUBFAMILIA]
		  WHERE T0.[WhsCode] = @alma 
			AND T1.[frozenFor] = 'n'
			--AND t2.descr = 'INSUMOS'
		  ORDER BY T1.[U_FAMILIA], T1.[U_SUBFAMILIA];
	 END

END;

