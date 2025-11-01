"use client"
import * as React from "react"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Loader2, ArrowLeft, Settings, Edit, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { UserForm } from "./components/UserForm"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useUser } from "@/hooks/use-user"
import { resetUserPassword, deleteUser } from "./actions"
import type { UserRole, AppUser as User } from "@/lib/types"
import { getUsers as getUsersServer } from "@/services/user-service-server";


const CREATE_ROLES: UserRole[] = ['ADMINISTRADOR', 'OPERATIVO'];
const EDIT_DELETE_ROLES: UserRole[] = ['ADMINISTRADOR', 'OPERATIVO'];
const RESET_PASS_ROLES: UserRole[] = ['ADMINISTRADOR'];

export default function UsersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user: currentUser } = useUser();

  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [userAction, setUserAction] = React.useState<{ type: 'delete' | 'reset', user: User } | null>(null);


  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    try {
        const usersData = await getUsersServer();
        setUsers(usersData);
    } catch (error) {
        console.error("Error fetching users: ", error);
        toast({
            title: "Error al Cargar Usuarios",
            description: "No se pudieron cargar los datos de los usuarios.",
            variant: "destructive"
        });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const canCreate = currentUser && CREATE_ROLES.includes(currentUser.role.toUpperCase() as UserRole);
  const canEdit = currentUser && EDIT_DELETE_ROLES.includes(currentUser.role.toUpperCase() as UserRole);
  const canDelete = currentUser && EDIT_DELETE_ROLES.includes(currentUser.role.toUpperCase() as UserRole);
  const canResetPassword = currentUser && RESET_PASS_ROLES.includes(currentUser.role.toUpperCase() as UserRole);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsSheetOpen(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setIsSheetOpen(true);
  };

  const handleSheetClose = (open: boolean) => {
    if (!open) {
      setEditingUser(null);
    }
    setIsSheetOpen(open);
  };

  const handleFormFinished = () => {
    setIsSheetOpen(false);
    fetchUsers();
  };

  const handleConfirmAction = async () => {
    if (!userAction || !currentUser) return;

    if (userAction.type === 'delete') {
      try {
        await deleteUser(userAction.user.id, currentUser);
        toast({
          title: "Usuario Eliminado",
          description: "El usuario ha sido eliminado.",
        });
        fetchUsers();
      } catch (error: any) {
        toast({
          title: "Error al Eliminar",
          description: error.message || "No se pudo eliminar el usuario.",
          variant: "destructive",
        });
      }
    } else if (userAction.type === 'reset') {
      try {
        await resetUserPassword(userAction.user.id, currentUser);
        toast({
          title: "Contraseña Reseteada",
          description: `Se ha forzado el cambio de contraseña para ${userAction.user.fullName}.`,
        });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
    setUserAction(null);
  };

  return (
    <div>
      <div className="flex justify-end mb-6">
        {canCreate && (
            <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Usuario
            </Button>
        )}
      </div>

      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {loading ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                </TableRow>
            ) : users.length > 0 ? (
                users.map((user) => (
                <TableRow key={user.id}>
                    <TableCell className="font-medium uppercase">{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="uppercase">{user.role}</TableCell>
                    <TableCell className="uppercase">{user.sucursalName}</TableCell>
                    <TableCell>
                    <Badge variant={user.active ? 'default' : 'secondary'}>{user.active ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!canEdit && !canDelete && !canResetPassword}>
                            <Settings className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           {canEdit && <DropdownMenuItem onSelect={() => handleEdit(user)}><Edit className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>}
                           {canResetPassword && <DropdownMenuItem onSelect={() => setUserAction({ type: 'reset', user })}>Resetear Contraseña</DropdownMenuItem>}
                           {canDelete && <DropdownMenuItem onSelect={() => setUserAction({ type: 'delete', user })} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </TableCell>
                </TableRow>
                ))
            ) : (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                    No hay usuarios registrados.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingUser ? "Editar Usuario" : "Agregar Nuevo Usuario"}</SheetTitle>
          </SheetHeader>
          <UserForm onFinished={handleFormFinished} initialData={editingUser} />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!userAction} onOpenChange={(open) => !open && setUserAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
                {userAction?.type === 'delete' 
                    ? "Esta acción no se puede deshacer y eliminará al usuario permanentemente." 
                    : "Esto forzará al usuario a cambiar su contraseña en el próximo inicio de sesión."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleConfirmAction} 
                className={userAction?.type === 'delete' ? 'bg-destructive hover:bg-destructive/80' : ''}>
                    {userAction?.type === 'delete' ? 'Eliminar' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
