CREATE PROCEDURE [dbo].[USP_AlMACENES_SAP_CIAS]
	@CIA nvarchar(20)
	
AS
BEGIN
  IF @CIA ='VESER'
     BEGIN
	 SELECT al.WhsCode 'Codigo Almacen', al.WhsName 'Nombre' FROM [VESER].[dbo].OWHS al where al.Inactive='n'
	 END
	 IF @CIA ='RECREFAM'
     BEGIN
	 SELECT al.WhsCode 'Codigo Almacen', al.WhsName 'Nombre' FROM [RECREFAM].[dbo].OWHS al where al.Inactive='n'
	 END
	 IF @CIA ='OPARDIV'
     BEGIN
	 SELECT al.WhsCode 'Codigo Almacen', al.WhsName 'Nombre' FROM [OPARDIV].[dbo].OWHS al where al.Inactive='n'
	 END

END
