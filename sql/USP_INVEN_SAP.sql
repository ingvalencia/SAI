CREATE PROCEDURE [dbo].[USP_INVEN_SAP]
  @alma nvarchar(20),
  @fecint date,
  @usuario int,
  @cia nvarchar(20)
AS
BEGIN
  IF @cia = 'RECREFAM'
  BEGIN
    SELECT 
      T1.[U_FAMILIA] Codfam,
      t2.descr AS Familia,
      T1.[U_SUBFAMILIA] Codsubfam,
      t3.descr AS Subfamilia,
      T0.[ItemCode] AS [Codigo sap], 
      T1.[ItemName] AS Nombre, 
      T0.[WhsCode] AS Almacen, 
      T0.[OnHand] AS Inventario_sap,
      GETDATE() AS fecha_carga,
      @fecint AS FEC_INTRT,
      T1.CodeBars,
      @cia AS CIA,
      @usuario AS Usuario
    FROM [RECREFAM].[dbo].OITW T0 
    INNER JOIN [RECREFAM].[dbo].OITM T1 ON T0.[ItemCode] = T1.[ItemCode]
    LEFT JOIN [RECREFAM].[dbo].ufd1 t2 ON t2.tableid = 'oitm' AND t2.fieldid = 0 AND t2.fldvalue = T1.[U_FAMILIA]
    LEFT JOIN [RECREFAM].[dbo].ufd1 t3 ON t3.tableid = 'oitm' AND t3.fieldid = 1 AND t3.fldvalue = T1.[U_SUBFAMILIA]
    WHERE T0.[WhsCode] = @alma AND T1.[frozenFor] = 'n'--- AND t2.descr = 'INSUMOS'
    ORDER BY T1.[U_FAMILIA], T1.[U_SUBFAMILIA]
  END

  IF @cia = 'VESER'
  BEGIN
    SELECT 
      T1.[U_FAMILIA] Codfam,
      t2.descr AS Familia,
      T1.[U_SUBFAMILIA] Codsubfam,
      T1.[U_SUBFAMILIA] AS Subfamilia,
      T0.[ItemCode] AS [Codigo sap], 
      T1.[ItemName] AS Nombre, 
      T0.[WhsCode] AS Almacen, 
      T0.[OnHand] AS Inventario_sap,
      GETDATE() AS fecha_carga,
      @fecint AS FEC_INTRT,
      T1.CodeBars,
      @cia AS CIA,
      @usuario AS Usuario
    FROM [VESER].[dbo].OITW T0 
    INNER JOIN [VESER].[dbo].OITM T1 ON T0.[ItemCode] = T1.[ItemCode]
    LEFT JOIN [VESER].[dbo].ufd1 t2 ON t2.tableid = 'oitm' AND t2.fieldid = 12 AND t2.fldvalue = T1.[U_FAMILIA]
    LEFT JOIN [VESER].[dbo].ufd1 t3 ON t3.tableid = 'oitm' AND t3.fieldid = 1 AND t3.fldvalue = T1.[U_SUBFAMILIA]
    WHERE T0.[WhsCode] = @alma AND T1.[frozenFor] = 'n'
    ORDER BY T1.[U_FAMILIA], T1.[U_SUBFAMILIA]
  END

  IF @cia = 'OPARDIV'
  BEGIN
    SELECT 
      T1.[U_FAMILIA] Codfam,
      t2.descr AS Familia,
      T1.[U_SUBFAMILIA] Codsubfam,
      t3.descr AS Subfamilia,
      T0.[ItemCode] AS [Codigo sap], 
      T1.[ItemName] AS Nombre, 
      T0.[WhsCode] AS Almacen, 
      T0.[OnHand] AS Inventario_sap,
      GETDATE() AS fecha_carga,
      @fecint AS FEC_INTRT,
      T1.CodeBars,
      @cia AS CIA,
      @usuario AS Usuario
    FROM [OPARDIV].[dbo].OITW T0 
    INNER JOIN [OPARDIV].[dbo].OITM T1 ON T0.[ItemCode] = T1.[ItemCode]
    LEFT JOIN [OPARDIV].[dbo].ufd1 t2 ON t2.tableid = 'oitm' AND t2.fieldid = 0 AND t2.fldvalue = T1.[U_FAMILIA]
    LEFT JOIN [OPARDIV].[dbo].ufd1 t3 ON t3.tableid = 'oitm' AND t3.fieldid = 1 AND t3.fldvalue = T1.[U_SUBFAMILIA]
    WHERE T0.[WhsCode] = @alma AND T1.[frozenFor] = 'n'
    ORDER BY T1.[U_FAMILIA], T1.[U_SUBFAMILIA]
  END
END









