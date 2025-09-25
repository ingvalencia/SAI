CREATE PROCEDURE USP_CONTROL_CARGA_INVENTARIO
  @almacen NVARCHAR(20),
  @fecha DATE,
  @num_empleado INT,
  @cia NVARCHAR(30),
  @modo_resultado NVARCHAR(20) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @usuario_actual INT;

  IF EXISTS (
    SELECT 1
    FROM CAP_INVENTARIO
    WHERE almacen = @almacen AND fecha_inv = @fecha AND estatus IN (1, 2)
  )
  BEGIN
    SET @modo_resultado = 'solo lectura';

    INSERT INTO LOG_USO_CAPTURA_INVENTARIOS (
      almacen, fecha_inv, num_empleado, modo
    )
    VALUES (
      @almacen, @fecha, @num_empleado, @modo_resultado
    );

    RETURN;
  END

  IF EXISTS (
    SELECT 1
    FROM CAP_INVENTARIO
    WHERE almacen = @almacen AND fecha_inv = @fecha
  )
  BEGIN
    SELECT TOP 1 @usuario_actual = usuario
    FROM CAP_INVENTARIO
    WHERE almacen = @almacen AND fecha_inv = @fecha AND estatus = 0;

    IF @usuario_actual = @num_empleado
    BEGIN
      SET @modo_resultado = 'edicion';
    END
    ELSE
    BEGIN
      SET @modo_resultado = 'solo lectura';
    END

    INSERT INTO LOG_USO_CAPTURA_INVENTARIOS (
      almacen, fecha_inv, num_empleado, modo
    )
    VALUES (
      @almacen, @fecha, @num_empleado, @modo_resultado
    );

    RETURN;
  END

  INSERT INTO CAP_INVENTARIO (
    cod_fam, nom_fam, cod_subfam, nom_subfam,
    ItemCode, ItemName, almacen, cant_invfis,
    fecha_carga, fecha_inv, usuario, estatus,
    CodeBars, cias
  )
  EXEC dbo.USP_INVENTARIOS @almacen, @fecha, @num_empleado, @cia;

  SET @modo_resultado = 'edicion';

  INSERT INTO LOG_USO_CAPTURA_INVENTARIOS (
    almacen, fecha_inv, num_empleado, modo
  )
  VALUES (
    @almacen, @fecha, @num_empleado, @modo_resultado
  );
END
